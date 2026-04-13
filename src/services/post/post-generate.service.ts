import { getDataSource } from '@/lib/db/data-source';
import type { Session } from '@/lib/session-token';
import {
  BrandEntity,
  CategoryEntity,
  FlavorEntity,
  PostFormatEntity,
  ProductFormatEntity,
  SaleEntity,
  SaleItemEntity,
  ShopEntity,
  StockItemEntity,
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

export type PostGenerateBody = {
  selectedFormatIds: string[];
  categoryIds: string[];
  brandIds: string[];
  strengths: string[];
  colors: string[];
  postFormatId?: string;
  template?: string;
  config?: FormatConfig;
};

function parseBody(body: unknown): PostGenerateBody {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return {
    selectedFormatIds: Array.isArray(b.selectedFormatIds) ? (b.selectedFormatIds as string[]) : [],
    categoryIds: Array.isArray(b.categoryIds) ? (b.categoryIds as string[]) : [],
    brandIds: Array.isArray(b.brandIds) ? (b.brandIds as string[]) : [],
    strengths: Array.isArray(b.strengths) ? (b.strengths as string[]) : [],
    colors: Array.isArray(b.colors) ? (b.colors as string[]) : [],
    postFormatId: b.postFormatId as string | undefined,
    template: b.template as string | undefined,
    config: b.config as FormatConfig | undefined,
  };
}

export async function generatePostText(session: Session, body: unknown): Promise<{ text: string }> {
  const {
    selectedFormatIds,
    categoryIds,
    brandIds,
    strengths,
    colors,
    postFormatId,
    template: previewTemplate,
    config: previewConfig,
  } = parseBody(body);

  const ds = await getDataSource();

  const categoryRepo = ds.getRepository(CategoryEntity);
  const brandRepo = ds.getRepository(BrandEntity);
  const formatRepo = ds.getRepository(ProductFormatEntity);
  const flavorRepo = ds.getRepository(FlavorEntity);
  const stockRepo = ds.getRepository(StockItemEntity);
  const shopRepo = ds.getRepository(ShopEntity);

  const [categories, brands, formats, flavors, stocks, shop] = await Promise.all([
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

  const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));

  const now = new Date();
  const reservations = await ds.getRepository(SaleEntity).find({
    where: {
      shopId: session.shopId,
      isReservation: true,
      status: 'active',
    },
  });
  const activeReservations = reservations.filter(
    (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > now,
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
      (reservedQtyByFlavorId.get(item.flavorId) ?? 0) + item.quantity,
    );
  }

  let filteredFormats = formats;
  if (categoryIds.length > 0 || brandIds.length > 0 || strengths.length > 0 || colors.length > 0) {
    filteredFormats = formats.filter((f) => {
      const brand = brands.find((br) => br.id === f.brandId);
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

      if (colors.length > 0) {
        const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
        const hasMatchingColor = formatFlavors.some((flavor) => colors.includes(flavor.name.trim()));
        if (!hasMatchingColor) {
          return false;
        }
      }

      return true;
    });
  }

  const formatIds = new Set(
    selectedFormatIds.length > 0 ? selectedFormatIds : filteredFormats.map((f) => f.id),
  );

  let template: string | null = null;
  let formatConfig: FormatConfig = {};

  if (previewTemplate) {
    template = previewTemplate;
    formatConfig = previewConfig || {};
  } else if (postFormatId && postFormatId !== 'default') {
    const postFormat = await ds.getRepository(PostFormatEntity).findOne({
      where: [
        { id: postFormatId, isActive: true, shopId: IsNull() },
        { id: postFormatId, isActive: true, shopId: session.shopId },
      ],
    });
    if (postFormat) {
      template = postFormat.template;
      formatConfig = (postFormat.config as FormatConfig) || {};
    }
  }

  if (!template) {
    template = `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{content}`;
  }

  const categoriesData: CategoryData[] = [];

  for (const cat of categories) {
    const catBrands = brands.filter((b) => b.categoryId === cat.id);
    const brandsData: BrandData[] = [];

    for (const brand of catBrands) {
      const bFormats = filteredFormats.filter((f) => f.brandId === brand.id && formatIds.has(f.id));
      const formatsData: FormatData[] = [];

      for (const format of bFormats) {
        const fFlavors = flavors
          .filter((fl) => fl.productFormatId === format.id)
          .map((fl) => {
            const stock = stockMap.get(fl.id);
            const quantity = stock?.quantity ?? 0;
            const reservedQty = reservedQtyByFlavorId.get(fl.id) ?? 0;
            const availableQty = Math.max(0, quantity - reservedQty);
            return {
              id: fl.id,
              name: fl.name,
              stock: availableQty,
            } as FlavorData;
          })
          .filter((fl) => (fl.stock ?? 0) > 0);

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
    currencyCode: shop?.currency ?? 'BYN',
  };

  const text = renderTemplate(template, postData, formatConfig);

  return { text };
}
