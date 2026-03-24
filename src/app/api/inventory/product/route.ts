import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
} from '@/lib/db/entities';
import { z } from 'zod';

const emptyToUndefined = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : v;

const createSchema = z.object({
  barcode: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional(),
  categoryName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  brandId: z.string().uuid().optional(),
  brandName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  brandEmoji: z.string().optional(),
  formatId: z.string().uuid().optional(),
  formatName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  strengthLabel: z.string().optional(), // Для жидкостей/снюса - крепость (mg), для расходников - сопротивление (Ω)
  ohmValue: z.string().optional(), // Для расходников - омы (0.4, 1, 0.6)
  resistanceValue: z.string().optional(), // Для расходников — доп. подпись к позиции (текст)
  // Клиент шлёт flavorName: "" для расходников — без preprocess Zod ломает .min(1).optional()
  flavorName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  costPrice: z.number().finite().min(0, { message: 'Себестоимость не может быть отрицательной' }),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(0).default(0),
  customValues: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const PRICE_EPS = 0.005;
  if (parsed.data.costPrice > parsed.data.unitPrice + PRICE_EPS) {
    return NextResponse.json(
      { message: 'Себестоимость не может быть больше розничной цены' },
      { status: 400 }
    );
  }

  const {
    barcode,
    categoryId,
    categoryName,
    brandId,
    brandName,
    brandEmoji,
    formatId,
    formatName,
    strengthLabel,
    ohmValue,
    resistanceValue,
    flavorName,
    costPrice,
    unitPrice,
    quantity,
    customValues,
  } = parsed.data;

  const ds = await getDataSource();

  try {
    return await ds.transaction(async (em) => {
    const shopId = session.shopId;

    // 1. Resolve Category
    let catId = categoryId;
    if (!catId && categoryName) {
      // Try to find by name first
      let cat = await em.getRepository(CategoryEntity).findOne({
        where: { shopId, name: categoryName },
      });
      if (!cat) {
        // Create new
        const maxOrder = await em.getRepository(CategoryEntity).count({ where: { shopId } });
        cat = em.getRepository(CategoryEntity).create({
          shopId,
          name: categoryName,
          sortOrder: maxOrder + 1,
          emoji: '📦', // Default emoji
        });
        await em.getRepository(CategoryEntity).save(cat);
      }
      catId = cat.id;
    }

    if (!catId) {
      throw new Error('Category is required');
    }

    // 2. Resolve Brand
    let brId = brandId;
    if (!brId && brandName) {
      let brand = await em.getRepository(BrandEntity).findOne({
        where: { shopId, name: brandName, categoryId: catId },
      });
      if (!brand) {
        // Определяем sortOrder для нового бренда
        const maxOrder = await em
          .getRepository(BrandEntity)
          .createQueryBuilder('brand')
          .select('MAX(brand.sortOrder)', 'max')
          .where('brand.shopId = :shopId', { shopId })
          .andWhere('brand.categoryId = :categoryId', { categoryId: catId })
          .getRawOne();
        const sortOrder = (maxOrder?.max ?? 0) + 1;
        brand = em.getRepository(BrandEntity).create({
          shopId,
          categoryId: catId,
          name: brandName,
          emojiPrefix: brandEmoji || '',
          sortOrder,
        });
        await em.getRepository(BrandEntity).save(brand);
      }
      brId = brand.id;
    }

    if (!brId) {
      throw new Error('Brand is required');
    }

    // Определяем тип категории
    const category = await em.getRepository(CategoryEntity).findOne({
      where: { id: catId },
    });
    if (!category) {
      throw new Error('Category not found');
    }
    
    const categoryNameLower = category?.name?.toLowerCase() || '';
    const customFields = Array.isArray(category.customFields) ? category.customFields : [];
    const hasCustomFields = customFields.length > 0;
    
    // Определяем типы категорий для обратной совместимости
    const isLiquid = categoryNameLower.includes('жидкост') || categoryNameLower.includes('liquid');
    const isDevice = categoryNameLower.includes('устройств') || categoryNameLower.includes('device');
    const isSnus = categoryNameLower.includes('снюс') || categoryNameLower.includes('snus');
    const isConsumable =
      categoryNameLower.includes('расходник') ||
      categoryNameLower.includes('расходн') ||
      categoryNameLower.includes('consumable');
    
    // Определяем поля по customFields, если они настроены
    const strengthField = customFields.find((f: any) => f.target === 'strength_label');
    const flavorField = customFields.find((f: any) => f.target === 'flavor_name');

    // 3. Resolve Format
    let fmtId = formatId;
    if (!fmtId && formatName) {
      let format = await em.getRepository(ProductFormatEntity).findOne({
        where: { shopId, brandId: brId, name: formatName },
      });
      if (!format) {
        // Нормализуем крепость для жидкостей и снюса
        let normalizedStrength = '';
        let formatCustomValues: Record<string, any> | null = null;
        
        if (hasCustomFields && strengthField) {
          // Если есть настроенное поле для strength_label
          if (strengthLabel) {
            normalizedStrength = strengthLabel.trim();
            // Нормализуем для жидкостей/снюса
            if ((isLiquid || isSnus) && !normalizedStrength.toLowerCase().includes('mg') && !normalizedStrength.toLowerCase().includes('мг')) {
              const numMatch = normalizedStrength.match(/\d+/);
              if (numMatch) {
                normalizedStrength = `${numMatch[0]} mg`;
              }
            }
          }
          // Сохраняем customValues для полей strength_label
          formatCustomValues = {};
          const strengthFields = customFields.filter((f: any) => f.target === 'strength_label');
          
          // Добавляем значение из strengthLabel в customValues для соответствующего поля
          if (strengthLabel && strengthFields.length > 0) {
            // Используем первое поле с target='strength_label' для сохранения значения
            strengthFields.forEach((f: any) => {
              formatCustomValues![f.name] = normalizedStrength || strengthLabel.trim();
            });
          }
          
          // Добавляем дополнительные значения из customValues
          if (customValues && typeof customValues === 'object') {
            strengthFields.forEach((f: any) => {
              if (f.name in customValues && customValues[f.name]) {
                formatCustomValues![f.name] = customValues[f.name];
              }
            });
          }
          
          if (Object.keys(formatCustomValues).length === 0) {
            formatCustomValues = null;
          }
        } else {
          // Старая логика для обратной совместимости
          if (strengthLabel && (isLiquid || isSnus)) {
            normalizedStrength = strengthLabel.trim();
            if (!normalizedStrength.toLowerCase().includes('mg') && !normalizedStrength.toLowerCase().includes('мг')) {
              const numMatch = normalizedStrength.match(/\d+/);
              if (numMatch) {
                normalizedStrength = `${numMatch[0]} mg`;
              } else {
                normalizedStrength = strengthLabel.replace(/мг/gi, 'mg').trim();
              }
            } else {
              normalizedStrength = strengthLabel.replace(/мг/gi, 'mg').trim();
            }
          } else if (strengthLabel && isConsumable) {
            // Для расходников: сопротивление в strengthLabel
            normalizedStrength = strengthLabel.trim();
          }
        }
        
        format = em.getRepository(ProductFormatEntity).create({
          shopId,
          brandId: brId,
          name: formatName,
          unitPrice,
          isLiquid,
          strengthLabel: normalizedStrength,
          customValues: formatCustomValues ?? undefined,
        });
        await em.getRepository(ProductFormatEntity).save(format);
      } else {
        // Обновляем существующий формат, если переданы customValues
        if (hasCustomFields && strengthField && customValues && typeof customValues === 'object') {
          const formatCustomValues: Record<string, any> = format.customValues || {};
          let updated = false;
          customFields
            .filter((f: any) => f.target === 'strength_label' && f.name in customValues)
            .forEach((f: any) => {
              formatCustomValues[f.name] = customValues[f.name];
              updated = true;
            });
          if (updated) {
            format.customValues = formatCustomValues;
            await em.getRepository(ProductFormatEntity).save(format);
          }
        }
      }
      fmtId = format.id;
    }

    if (!fmtId) {
      throw new Error('Format is required');
    }

    // 4. Create Flavor
    let finalFlavorName = '';
    let flavorCustomValues: Record<string, any> | null = null;
    
    if (hasCustomFields && flavorField) {
      // Если есть настроенное поле для flavor_name
      finalFlavorName = flavorName || '';
      
      // Сохраняем customValues для полей flavor_name
      flavorCustomValues = {};
      const flavorFields = customFields.filter((f: any) => f.target === 'flavor_name');
      
      // Добавляем значение из flavorName в customValues для соответствующего поля
      if (flavorName && flavorFields.length > 0) {
        flavorFields.forEach((f: any) => {
          flavorCustomValues![f.name] = flavorName.trim();
        });
      }
      
      // Добавляем дополнительные значения из customValues
      if (customValues && typeof customValues === 'object') {
        // Добавляем значения для полей flavor_name
        flavorFields.forEach((f: any) => {
          if (f.name in customValues && customValues[f.name]) {
            flavorCustomValues![f.name] = customValues[f.name];
          }
        });
        // Также сохраняем поля с target='custom' в flavor
        customFields
          .filter((f: any) => f.target === 'custom' && f.name in customValues)
          .forEach((f: any) => {
            flavorCustomValues![f.name] = customValues[f.name];
          });
      }
      
      if (Object.keys(flavorCustomValues).length === 0) {
        flavorCustomValues = null;
      }
    } else {
      // Старая логика для обратной совместимости
      if (isConsumable) {
        // Для расходников: Flavor = доп. подпись (текст) или пустое; омы уже в formatName
        if (resistanceValue?.trim()) {
          finalFlavorName = resistanceValue.trim();
        } else {
          finalFlavorName = '';
        }
      } else if (isDevice) {
        // Для устройств: Flavor = цвет
        finalFlavorName = flavorName || '';
      } else {
        // Для жидкостей и снюса: Flavor = вкус
        finalFlavorName = flavorName || '';
      }
    }
    
    // Для расходников может быть пустое имя вкуса, используем уникальный ключ
    const flavorSearchName = isConsumable && !finalFlavorName 
      ? `__consumable_${fmtId}` // Уникальное имя для расходников без сопротивления
      : finalFlavorName;
    
    let flavor = await em.getRepository(FlavorEntity).findOne({
      where: { shopId, productFormatId: fmtId, name: flavorSearchName },
    });

    if (!flavor) {
        flavor = em.getRepository(FlavorEntity).create({
        shopId,
        productFormatId: fmtId,
        name: finalFlavorName || flavorSearchName,
        barcode: barcode || null,
        customValues: flavorCustomValues ?? undefined,
      });
      await em.getRepository(FlavorEntity).save(flavor);
    } else {
        // Update barcode if provided and empty
        if (barcode && !flavor.barcode) {
            flavor.barcode = barcode;
            await em.getRepository(FlavorEntity).save(flavor);
        }
        // Update customValues if provided
        if (flavorCustomValues !== null) {
          flavor.customValues = flavorCustomValues;
          await em.getRepository(FlavorEntity).save(flavor);
        }
    }

    // 5. Update Stock
    let stock = await em.getRepository(StockItemEntity).findOne({
      where: { shopId, flavorId: flavor.id },
    });

    if (!stock) {
      stock = em.getRepository(StockItemEntity).create({
        shopId,
        flavorId: flavor.id,
        quantity: quantity,
        costPrice,
      });
    } else {
      stock.quantity += quantity;
      stock.costPrice = costPrice; // Update cost price to latest
    }
    await em.getRepository(StockItemEntity).save(stock);

    return NextResponse.json({ success: true, flavorId: flavor.id });
    });
  } catch (err) {
    console.error('POST /api/inventory/product', err);
    const message =
      err instanceof Error ? err.message : 'Ошибка при создании товара';
    return NextResponse.json({ message }, { status: 500 });
  }
}
