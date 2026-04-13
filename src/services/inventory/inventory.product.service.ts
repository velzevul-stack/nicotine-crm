import type { EntityManager } from 'typeorm';
import {
  BrandEntity,
  CategoryEntity,
  FlavorEntity,
  ProductFormatEntity,
  StockItemEntity,
} from '@/lib/db/entities';
import { ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import { logStockMovement, resolveProductUiName } from '@/services/common/stock-movement.gateway';
import { PRICE_EPS, normalizeBarcode, normalizeName, normalizeNameKey } from '@/services/inventory/inventory.shared';
import { createProductSchema } from '@/services/inventory/inventory.product.validators';

export async function createProduct(context: ShopContext, body: unknown) {
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }
  if (parsed.data.costPrice > parsed.data.unitPrice + PRICE_EPS) {
    throw new ValidationError('Себестоимость не может быть больше розничной цены', undefined, {
      code: 'COST_EXCEEDS_UNIT',
    });
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
    resistanceValue,
    flavorName,
    costPrice,
    unitPrice,
    quantity,
    piecesPerPack,
    packCost,
    costPerPiece,
    customValues,
  } = parsed.data;

  const shopId = context.shopId;

  return withTransaction(async (em) => {
    let catId = categoryId;
    const normalizedCategoryName = categoryName ? normalizeName(categoryName) : undefined;
    if (!catId && normalizedCategoryName) {
      const allCategories = await em.getRepository(CategoryEntity).find({ where: { shopId } });
      let cat = allCategories.find(
        (c) => normalizeNameKey(c.name) === normalizeNameKey(normalizedCategoryName),
      );
      if (!cat) {
        const maxOrder = await em.getRepository(CategoryEntity).count({ where: { shopId } });
        cat = em.getRepository(CategoryEntity).create({
          shopId,
          name: normalizedCategoryName,
          sortOrder: maxOrder + 1,
          emoji: '📦',
        });
        await em.getRepository(CategoryEntity).save(cat);
      }
      catId = cat.id;
    }

    if (!catId) {
      throw new ValidationError('Category is required', undefined, { code: 'CATEGORY_REQUIRED' });
    }

    let brId = brandId;
    const normalizedBrandName = brandName ? normalizeName(brandName) : undefined;
    if (!brId && normalizedBrandName) {
      const existingBrands = await em.getRepository(BrandEntity).find({
        where: { shopId, categoryId: catId },
      });
      let brand = existingBrands.find(
        (b) => normalizeNameKey(b.name) === normalizeNameKey(normalizedBrandName),
      );
      if (!brand) {
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
          name: normalizedBrandName,
          emojiPrefix: brandEmoji || '',
          sortOrder,
        });
        await em.getRepository(BrandEntity).save(brand);
      }
      brId = brand.id;
    }

    if (!brId) {
      throw new ValidationError('Brand is required', undefined, { code: 'BRAND_REQUIRED' });
    }

    const category = await em.getRepository(CategoryEntity).findOne({
      where: { id: catId },
    });
    if (!category) {
      throw new ValidationError('Category not found', undefined, { code: 'CATEGORY_NOT_FOUND' });
    }

    const categoryNameLower = category?.name?.toLowerCase() || '';
    const customFields = Array.isArray(category.customFields) ? category.customFields : [];
    const hasCustomFields = customFields.length > 0;

    const isLiquid = categoryNameLower.includes('жидкост') || categoryNameLower.includes('liquid');
    const isDevice = categoryNameLower.includes('устройств') || categoryNameLower.includes('device');
    const isSnus = categoryNameLower.includes('снюс') || categoryNameLower.includes('snus');
    const isConsumable =
      categoryNameLower.includes('расходник') ||
      categoryNameLower.includes('расходн') ||
      categoryNameLower.includes('consumable');

    const strengthField = customFields.find((f: { target?: string }) => f.target === 'strength_label');
    const flavorField = customFields.find((f: { target?: string }) => f.target === 'flavor_name');

    let fmtId = formatId;
    const normalizedFormatName = formatName ? normalizeName(formatName) : undefined;
    if (!fmtId && normalizedFormatName) {
      const existingFormats = await em.getRepository(ProductFormatEntity).find({
        where: { shopId, brandId: brId },
      });
      let format = existingFormats.find(
        (f) => normalizeNameKey(f.name) === normalizeNameKey(normalizedFormatName),
      );
      if (!format) {
        let normalizedStrength = '';
        let formatCustomValues: Record<string, unknown> | null = null;

        if (hasCustomFields && strengthField) {
          if (strengthLabel) {
            normalizedStrength = strengthLabel.trim();
            if (
              (isLiquid || isSnus) &&
              !normalizedStrength.toLowerCase().includes('mg') &&
              !normalizedStrength.toLowerCase().includes('мг')
            ) {
              const numMatch = normalizedStrength.match(/\d+/);
              if (numMatch) {
                normalizedStrength = `${numMatch[0]} mg`;
              }
            }
          }
          formatCustomValues = {};
          const strengthFields = customFields.filter(
            (f: { target?: string }) => f.target === 'strength_label',
          );

          if (strengthLabel && strengthFields.length > 0) {
            strengthFields.forEach((f: { name: string }) => {
              formatCustomValues![f.name] = normalizedStrength || strengthLabel.trim();
            });
          }

          if (customValues && typeof customValues === 'object') {
            strengthFields.forEach((f: { name: string }) => {
              if (f.name in customValues && customValues[f.name]) {
                formatCustomValues![f.name] = customValues[f.name];
              }
            });
          }

          if (Object.keys(formatCustomValues).length === 0) {
            formatCustomValues = null;
          }
        } else {
          if (strengthLabel && (isLiquid || isSnus)) {
            normalizedStrength = strengthLabel.trim();
            if (
              !normalizedStrength.toLowerCase().includes('mg') &&
              !normalizedStrength.toLowerCase().includes('мг')
            ) {
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
            normalizedStrength = strengthLabel.trim();
          }
        }

        format = em.getRepository(ProductFormatEntity).create({
          shopId,
          brandId: brId,
          name: normalizedFormatName,
          unitPrice,
          isLiquid,
          strengthLabel: normalizedStrength,
          customValues: formatCustomValues ?? undefined,
        });
        await em.getRepository(ProductFormatEntity).save(format);
      } else {
        if (hasCustomFields && strengthField && customValues && typeof customValues === 'object') {
          const fc: Record<string, unknown> = format.customValues || {};
          let updated = false;
          customFields
            .filter(
              (f: { target?: string; name: string }) =>
                f.target === 'strength_label' && f.name in customValues,
            )
            .forEach((f: { name: string }) => {
              fc[f.name] = customValues[f.name];
              updated = true;
            });
          if (updated) {
            format.customValues = fc;
            await em.getRepository(ProductFormatEntity).save(format);
          }
        }
      }
      fmtId = format.id;
    }

    if (!fmtId) {
      throw new ValidationError('Format is required', undefined, { code: 'FORMAT_REQUIRED' });
    }

    let finalFlavorName = '';
    let flavorCustomValues: Record<string, unknown> | null = null;

    if (hasCustomFields && flavorField) {
      finalFlavorName = flavorName || '';
      flavorCustomValues = {};
      const flavorFields = customFields.filter((f: { target?: string }) => f.target === 'flavor_name');

      if (flavorName && flavorFields.length > 0) {
        flavorFields.forEach((f: { name: string }) => {
          flavorCustomValues![f.name] = flavorName.trim();
        });
      }

      if (customValues && typeof customValues === 'object') {
        flavorFields.forEach((f: { name: string }) => {
          if (f.name in customValues && customValues[f.name]) {
            flavorCustomValues![f.name] = customValues[f.name];
          }
        });
        customFields
          .filter((f: { target?: string; name: string }) => f.target === 'custom' && f.name in customValues)
          .forEach((f: { name: string }) => {
            flavorCustomValues![f.name] = customValues[f.name];
          });
      }

      if (Object.keys(flavorCustomValues).length === 0) {
        flavorCustomValues = null;
      }
    } else {
      if (isConsumable) {
        if (resistanceValue?.trim()) {
          finalFlavorName = resistanceValue.trim();
        } else {
          finalFlavorName = '';
        }
      } else if (isDevice) {
        finalFlavorName = flavorName || '';
      } else {
        finalFlavorName = flavorName || '';
      }
    }

    finalFlavorName = normalizeName(finalFlavorName);
    const flavorSearchName =
      isConsumable && !finalFlavorName ? `__consumable_${fmtId}` : finalFlavorName;
    const normalizedFlavorNameKey = normalizeNameKey(flavorSearchName);

    let flavor = await em.getRepository(FlavorEntity).findOne({
      where: { shopId, productFormatId: fmtId, normalizedName: normalizedFlavorNameKey },
    });
    if (!flavor) {
      const existingFlavors = await em.getRepository(FlavorEntity).find({
        where: { shopId, productFormatId: fmtId },
      });
      flavor =
        existingFlavors.find((f) => normalizeNameKey(f.name) === normalizedFlavorNameKey) ?? null;
    }

    if (!flavor) {
      flavor = em.getRepository(FlavorEntity).create({
        shopId,
        productFormatId: fmtId,
        name: finalFlavorName || flavorSearchName,
        barcode: barcode ? normalizeBarcode(barcode) : null,
        normalizedName: normalizedFlavorNameKey,
        customValues: flavorCustomValues ?? undefined,
      });
      await em.getRepository(FlavorEntity).save(flavor);
    } else {
      if (barcode && !flavor.barcode) {
        flavor.barcode = normalizeBarcode(barcode);
        flavor.normalizedName =
          flavor.normalizedName || normalizeNameKey(flavor.name || flavorSearchName);
        await em.getRepository(FlavorEntity).save(flavor);
      }
      if (flavorCustomValues !== null) {
        flavor.customValues = flavorCustomValues;
        flavor.normalizedName =
          flavor.normalizedName || normalizeNameKey(flavor.name || flavorSearchName);
        await em.getRepository(FlavorEntity).save(flavor);
      }
    }

    await upsertStockAndLog(em, shopId, flavor.id, {
      quantity,
      costPrice,
      packCost,
      piecesPerPack,
      costPerPiece,
    });

    return { success: true as const, flavorId: flavor.id };
  });
}

async function upsertStockAndLog(
  em: EntityManager,
  shopId: string,
  flavorId: string,
  input: {
    quantity: number;
    costPrice: number;
    packCost?: number | null;
    piecesPerPack?: number | null;
    costPerPiece?: number | null;
  },
) {
  const { quantity, costPrice, packCost, piecesPerPack, costPerPiece } = input;
  let stock = await em.getRepository(StockItemEntity).findOne({
    where: { shopId, flavorId },
  });

  if (!stock) {
    const beforeQty = 0;
    const beforePostQty = 0;
    stock = em.getRepository(StockItemEntity).create({
      shopId,
      flavorId,
      quantity,
      postQuantity: quantity,
      costPrice,
      packCost: packCost ?? null,
      piecesPerPack: piecesPerPack ?? null,
      costPerPiece: costPerPiece ?? null,
    });
    await em.getRepository(StockItemEntity).save(stock);
    if (quantity > 0) {
      await logStockMovement(em, {
        shopId,
        productId: flavorId,
        productName: await resolveProductUiName(em, shopId, flavorId),
        actionType: 'receipt_to_warehouse',
        fromZone: null,
        toZone: 'warehouse',
        quantity,
        postStockBefore: beforePostQty,
        postStockAfter: stock.postQuantity ?? quantity,
        warehouseBefore: beforeQty,
        warehouseAfter: quantity,
        comment: 'Приемка товара',
      });
    }
  } else {
    const beforeQty = stock.quantity;
    const beforePostQty = stock.postQuantity ?? stock.quantity;
    stock.quantity += quantity;
    stock.postQuantity = stock.quantity;
    stock.costPrice = costPrice;
    if (typeof packCost === 'number') stock.packCost = packCost;
    if (typeof piecesPerPack === 'number') stock.piecesPerPack = piecesPerPack;
    if (typeof costPerPiece === 'number') stock.costPerPiece = costPerPiece;
    await em.getRepository(StockItemEntity).save(stock);
    if (quantity > 0) {
      await logStockMovement(em, {
        shopId,
        productId: flavorId,
        productName: await resolveProductUiName(em, shopId, flavorId),
        actionType: 'receipt_to_warehouse',
        fromZone: null,
        toZone: 'warehouse',
        quantity,
        postStockBefore: beforePostQty,
        postStockAfter: stock.postQuantity ?? stock.quantity,
        warehouseBefore: beforeQty,
        warehouseAfter: stock.quantity,
        comment: 'Приемка товара',
      });
    }
  }
}
