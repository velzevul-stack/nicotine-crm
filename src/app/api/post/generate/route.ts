import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
  PostFormatEntity,
  ShopEntity,
  SaleEntity,
  SaleItemEntity,
} from '@/lib/db/entities';
import { In, IsNull } from 'typeorm';
import {
  renderTemplate,
  PostData,
  CategoryData,
  BrandData,
  FormatData,
  FlavorData,
  ShopData,
  FormatConfig,
} from '@/lib/post/template-renderer';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const selectedFormatIds = (body.selectedFormatIds as string[]) ?? [];
  const categoryIds = (body.categoryIds as string[] | undefined) ?? [];
  const brandIds = (body.brandIds as string[] | undefined) ?? [];
  const strengths = (body.strengths as string[] | undefined) ?? [];
  const colors = (body.colors as string[] | undefined) ?? [];
  const postFormatId = (body.postFormatId as string | undefined);
  const previewTemplate = (body.template as string | undefined);
  const previewConfig = (body.config as FormatConfig | undefined);

  const ds = await getDataSource();
  
  // Используем транзакцию для предотвращения параллельных запросов на одном соединении
  const [categories, brands, formats, flavors, stocks, shop] = await ds.transaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);
    const brandRepo = em.getRepository(BrandEntity);
    const formatRepo = em.getRepository(ProductFormatEntity);
    const flavorRepo = em.getRepository(FlavorEntity);
    const stockRepo = em.getRepository(StockItemEntity);
    const shopRepo = em.getRepository(ShopEntity);

    return Promise.all([
      categoryRepo.find({
        where: { shopId: session.shopId },
        order: { sortOrder: 'ASC' },
      }),
      brandRepo.find({ 
        where: { shopId: session.shopId },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      formatRepo.find({
        where: { shopId: session.shopId, isActive: true },
      }),
      flavorRepo.find({
        where: { shopId: session.shopId, isActive: true },
      }),
      stockRepo.find({ where: { shopId: session.shopId } }),
      shopRepo.findOne({ where: { id: session.shopId } }),
    ]);
  });

  const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));

  // Вычисляем зарезервированное количество по активным резервам (expiry null или > now)
  const now = new Date();
  const reservations = await ds.getRepository(SaleEntity).find({
    where: {
      shopId: session.shopId,
      isReservation: true,
      status: 'active',
    },
  });
  const activeReservations = reservations.filter(
    (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > now
  );
  const reservationIds = activeReservations.map((r) => r.id);
  const reservationItems =
    reservationIds.length > 0
      ? await ds.getRepository(SaleItemEntity).find({
          where: { saleId: In(reservationIds) },
        })
      : [];
  const reservedQtyByFlavorId = new Map<string, number>();
  for (const item of reservationItems) {
    reservedQtyByFlavorId.set(
      item.flavorId,
      (reservedQtyByFlavorId.get(item.flavorId) ?? 0) + item.quantity
    );
  }
  
  // Apply filters to formats
  let filteredFormats = formats;
  if (categoryIds.length > 0 || brandIds.length > 0 || strengths.length > 0 || colors.length > 0) {
    filteredFormats = formats.filter((f) => {
      const brand = brands.find((b) => b.id === f.brandId);
      if (!brand) return false;
      
      if (categoryIds.length > 0 && !categoryIds.includes(brand.categoryId)) {
        return false;
      }
      if (brandIds.length > 0 && !brandIds.includes(brand.id)) {
        return false;
      }
      if (strengths.length > 0) {
        const strength = (f.strengthLabel || '').replace(/мг/gi, 'mg').trim();
        if (!strengths.includes(strength)) {
          return false;
        }
      }
      
      // Фильтр по цвету: проверяем, есть ли у формата хотя бы один flavor с выбранным цветом
      if (colors.length > 0) {
        const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
        const hasMatchingColor = formatFlavors.some((flavor) => 
          colors.includes(flavor.name.trim())
        );
        if (!hasMatchingColor) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  const formatIds = new Set(
    selectedFormatIds.length > 0 ? selectedFormatIds : filteredFormats.map((f) => f.id)
  );

  // Get post format template if specified
  let template: string | null = null;
  let formatConfig: FormatConfig = {};
  
  // If preview template is provided, use it (for preview mode)
  if (previewTemplate) {
    template = previewTemplate;
    formatConfig = previewConfig || {};
  } else if (postFormatId && postFormatId !== 'default') {
    const postFormat = await ds.transaction(async (em) => {
      const postFormatRepo = em.getRepository(PostFormatEntity);
      // Get format: either global (shopId is null) or shop-specific
      return postFormatRepo.findOne({
        where: [
          { id: postFormatId, isActive: true, shopId: IsNull() },
          { id: postFormatId, isActive: true, shopId: session.shopId },
        ],
      });
    });
    if (postFormat) {
      template = postFormat.template;
      formatConfig = (postFormat.config as FormatConfig) || {};
    }
  }

  // If no template specified, use default
  if (!template) {
    template = `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{content}`;
  }

  // Build data structure for template renderer
  const categoriesData: CategoryData[] = [];

  for (const cat of categories) {
    const catBrands = brands.filter((b) => b.categoryId === cat.id);
    const brandsData: BrandData[] = [];

    for (const brand of catBrands) {
      const bFormats = filteredFormats.filter(
        (f) => f.brandId === brand.id && formatIds.has(f.id)
      );
      const formatsData: FormatData[] = [];

      for (const format of bFormats) {
        const fFlavors = flavors
          .filter((f) => f.productFormatId === format.id)
          .map((f) => {
            const stock = stockMap.get(f.id);
            const quantity = stock?.quantity ?? 0;
            const reservedQty = reservedQtyByFlavorId.get(f.id) ?? 0;
            const availableQty = Math.max(0, quantity - reservedQty);
            return {
              id: f.id,
              name: f.name,
              stock: availableQty,
            } as FlavorData;
          })
          .filter((f) => f.stock > 0); // Показываем только товары в наличии

        // Skip format if no flavors and flavors are required
        if (fFlavors.length === 0 && formatConfig.showFlavors !== false) {
          continue;
        }

        formatsData.push({
          id: format.id,
          name: format.name,
          price: format.unitPrice,
          strength: format.strengthLabel || undefined,
          flavors: fFlavors,
        });
      }

      if (formatsData.length > 0) {
        brandsData.push({
          id: brand.id,
          name: brand.name,
          emojiPrefix: brand.emojiPrefix || '',
          formats: formatsData,
        });
      }
    }

    if (brandsData.length > 0) {
      categoriesData.push({
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji || '📦',
        brands: brandsData,
      });
    }
  }

  const shopData: ShopData | undefined = shop
    ? {
        name: shop.name,
        address: shop.address || undefined,
      }
    : undefined;

  const postData: PostData = {
    categories: categoriesData,
    shop: shopData,
  };

  // Render template
  const text = renderTemplate(template, postData, formatConfig);

  return NextResponse.json({ text });
}
