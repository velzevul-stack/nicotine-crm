import { getDataSource } from '@/lib/db/data-source';
import { BrandEntity, CategoryEntity } from '@/lib/db/entities';
import { ensureDefaultCategoriesForShop } from '@/lib/db/ensure-default-categories';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/services/inventory/inventory.categories.validators';

export async function listCategories(context: ShopContext) {
  const ds = await getDataSource();
  const categoryRepo = ds.getRepository(CategoryEntity);

  await ensureDefaultCategoriesForShop(ds, context.shopId);

  const categories = await categoryRepo.find({
    where: { shopId: context.shopId },
    order: { sortOrder: 'ASC', name: 'ASC' },
  });

  const categoriesWithDefaults = categories.map((cat) => ({
    ...cat,
    customFields: cat.customFields || [],
  }));

  return { categories: categoriesWithDefaults };
}

export async function createCategory(context: ShopContext, body: unknown) {
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);

    const existing = await categoryRepo.findOne({
      where: { shopId: context.shopId, name: parsed.data.name },
    });

    if (existing) {
      throw new ValidationError('Категория с таким названием уже существует', undefined, {
        code: 'DUPLICATE_CATEGORY_NAME',
      });
    }

    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await categoryRepo
        .createQueryBuilder('category')
        .select('MAX(category.sortOrder)', 'max')
        .where('category.shopId = :shopId', { shopId: context.shopId })
        .getRawOne();
      sortOrder = (maxOrder?.max ?? 0) + 1;
    }

    const category = categoryRepo.create({
      shopId: context.shopId,
      name: parsed.data.name,
      emoji: parsed.data.emoji || '📦',
      sortOrder,
      customFields:
        parsed.data.customFields && parsed.data.customFields.length > 0
          ? parsed.data.customFields
          : [],
    });

    const saved = await categoryRepo.save(category);
    return {
      category: {
        ...saved,
        customFields: saved.customFields || [],
      },
    };
  });
}

export async function updateCategory(context: ShopContext, body: unknown) {
  const raw = body as { id?: string; [k: string]: unknown };
  if (!raw?.id || typeof raw.id !== 'string') {
    throw new ValidationError('Category ID required', undefined, { code: 'ID_REQUIRED' });
  }

  const { id, ...updates } = raw;
  const parsed = updateCategorySchema.safeParse(updates);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);

    const category = await categoryRepo.findOne({
      where: { id, shopId: context.shopId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (parsed.data.name && parsed.data.name !== category.name) {
      const existing = await categoryRepo.findOne({
        where: { shopId: context.shopId, name: parsed.data.name },
      });

      if (existing) {
        throw new ValidationError('Категория с таким названием уже существует', undefined, {
          code: 'DUPLICATE_CATEGORY_NAME',
        });
      }
    }

    if (parsed.data.name !== undefined) category.name = parsed.data.name;
    if (parsed.data.emoji !== undefined) category.emoji = parsed.data.emoji;
    if (parsed.data.sortOrder !== undefined) category.sortOrder = parsed.data.sortOrder;
    if (parsed.data.customFields !== undefined) {
      category.customFields =
        parsed.data.customFields && parsed.data.customFields.length > 0
          ? parsed.data.customFields
          : [];
    }

    const saved = await categoryRepo.save(category);
    return {
      category: {
        ...saved,
        customFields: saved.customFields || [],
      },
    };
  });
}

export async function deleteCategory(context: ShopContext, categoryId: string) {
  return withTransaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);
    const brandRepo = em.getRepository(BrandEntity);

    const category = await categoryRepo.findOne({
      where: { id: categoryId, shopId: context.shopId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const brandsCount = await brandRepo.count({
      where: { categoryId },
    });

    if (brandsCount > 0) {
      throw new ValidationError(
        `Невозможно удалить категорию: в ней есть ${brandsCount} бренд(ов). Сначала удалите или переместите все бренды из этой категории.`,
        undefined,
        { code: 'CATEGORY_HAS_BRANDS' },
      );
    }

    await categoryRepo.remove(category);
    return { success: true as const };
  });
}
