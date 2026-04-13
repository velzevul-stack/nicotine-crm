import { getDataSource } from '@/lib/db/data-source';
import { BrandEntity, CategoryEntity, ProductFormatEntity } from '@/lib/db/entities';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import {
  reorderCategoryBrandsSchema,
  reorderTwoBrandsSchema,
  updateBrandSchema,
} from '@/services/inventory/inventory.brand.validators';

export async function listBrands(context: ShopContext) {
  const ds = await getDataSource();
  const brandRepo = ds.getRepository(BrandEntity);
  const brands = await brandRepo.find({
    where: { shopId: context.shopId },
    order: { sortOrder: 'ASC', name: 'ASC' },
  });
  return { brands };
}

export async function updateBrand(context: ShopContext, brandId: string, body: unknown) {
  const parsed = updateBrandSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);
    const brand = await brandRepo.findOne({
      where: { id: brandId, shopId: context.shopId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (parsed.data.name !== undefined) brand.name = parsed.data.name;
    if (parsed.data.emojiPrefix !== undefined) brand.emojiPrefix = parsed.data.emojiPrefix;
    if (parsed.data.photoUrl !== undefined) brand.photoUrl = parsed.data.photoUrl;
    if (parsed.data.sortOrder !== undefined) brand.sortOrder = parsed.data.sortOrder;

    if (parsed.data.categoryId !== undefined) {
      const categoryRepo = em.getRepository(CategoryEntity);
      const category = await categoryRepo.findOne({
        where: { id: parsed.data.categoryId, shopId: context.shopId },
      });

      if (!category) {
        throw new NotFoundError('Category not found');
      }

      brand.categoryId = parsed.data.categoryId;
    }

    await brandRepo.save(brand);

    return { success: true as const, brand };
  });
}

export async function deleteBrand(context: ShopContext, brandId: string) {
  return withTransaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);
    const formatRepo = em.getRepository(ProductFormatEntity);

    const brand = await brandRepo.findOne({
      where: { id: brandId, shopId: context.shopId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    const formatsCount = await formatRepo.count({
      where: { brandId, shopId: context.shopId },
    });

    if (formatsCount > 0) {
      throw new ValidationError(
        `Невозможно удалить бренд: в нём есть ${formatsCount} формат(ов) продукта. Сначала удалите или переместите все форматы из этого бренда.`,
        undefined,
        { code: 'BRAND_HAS_FORMATS' },
      );
    }

    await brandRepo.remove(brand);

    return { success: true as const };
  });
}

export async function reorderTwoBrands(context: ShopContext, body: unknown) {
  const parsed = reorderTwoBrandsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);

    const brand1 = await brandRepo.findOne({
      where: { id: parsed.data.brandId1, shopId: context.shopId },
    });
    const brand2 = await brandRepo.findOne({
      where: { id: parsed.data.brandId2, shopId: context.shopId },
    });

    if (!brand1 || !brand2) {
      throw new NotFoundError('One or both brands not found');
    }

    if (brand1.categoryId !== brand2.categoryId) {
      throw new ValidationError('Brands must be from the same category', undefined, {
        code: 'BRANDS_DIFFERENT_CATEGORY',
      });
    }

    brand1.sortOrder = parsed.data.sortOrder1;
    brand2.sortOrder = parsed.data.sortOrder2;

    await brandRepo.save(brand1);
    await brandRepo.save(brand2);

    const savedBrand1 = await brandRepo.findOne({ where: { id: brand1.id } });
    const savedBrand2 = await brandRepo.findOne({ where: { id: brand2.id } });

    return {
      success: true as const,
      brand1: {
        id: brand1.id,
        name: brand1.name,
        sortOrder: savedBrand1?.sortOrder ?? brand1.sortOrder,
      },
      brand2: {
        id: brand2.id,
        name: brand2.name,
        sortOrder: savedBrand2?.sortOrder ?? brand2.sortOrder,
      },
    };
  });
}

export async function reorderBrandsInCategory(context: ShopContext, body: unknown) {
  const parsed = reorderCategoryBrandsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);

    const brands = await brandRepo.find({
      where: {
        shopId: context.shopId,
        categoryId: parsed.data.categoryId,
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const brandMap = new Map(brands.map((b) => [b.id, b]));
    for (const bid of parsed.data.brandIds) {
      if (!brandMap.has(bid)) {
        throw new NotFoundError(`Brand ${bid} not found in category`);
      }
    }

    for (let index = 0; index < parsed.data.brandIds.length; index++) {
      const bid = parsed.data.brandIds[index]!;
      const brand = brandMap.get(bid)!;
      brand.sortOrder = index + 1;
      await brandRepo.save(brand);
    }

    return {
      success: true as const,
      message: `Updated sortOrder for ${parsed.data.brandIds.length} brands`,
    };
  });
}
