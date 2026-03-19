import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { CategoryEntity, BrandEntity, type CategoryField } from '@/lib/db/entities';
import { z } from 'zod';

const categoryFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'select']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  sortOrder: z.number().int(),
  target: z.enum(['flavor_name', 'strength_label', 'custom']).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1, 'Название категории обязательно').max(100, 'Название слишком длинное'),
  emoji: z.string().max(10, 'Эмодзи слишком длинное').default('📦'),
  sortOrder: z.number().int().optional(),
  customFields: z.array(categoryFieldSchema).optional().default([]),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(),
  customFields: z.array(categoryFieldSchema).optional(),
});

// GET - получить все категории пользователя
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const categoryRepo = ds.getRepository(CategoryEntity);

  const categories = await categoryRepo.find({
    where: { shopId: session.shopId },
    order: { sortOrder: 'ASC', name: 'ASC' },
  });

  // Убеждаемся, что customFields всегда массив
  const categoriesWithDefaults = categories.map(cat => ({
    ...cat,
    customFields: cat.customFields || [],
  }));

  return NextResponse.json({ categories: categoriesWithDefaults });
}

// POST - создать новую категорию
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  try {
    return await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);

      // Проверка на дубликат названия
      const existing = await categoryRepo.findOne({
        where: { shopId: session.shopId, name: parsed.data.name },
      });

      if (existing) {
        throw new Error('Категория с таким названием уже существует');
      }

      // Определяем sortOrder если не указан
      let sortOrder = parsed.data.sortOrder;
      if (sortOrder === undefined) {
        const maxOrder = await categoryRepo
          .createQueryBuilder('category')
          .select('MAX(category.sortOrder)', 'max')
          .where('category.shopId = :shopId', { shopId: session.shopId })
          .getRawOne();
        sortOrder = (maxOrder?.max ?? 0) + 1;
      }

      const category = categoryRepo.create({
        shopId: session.shopId,
        name: parsed.data.name,
        emoji: parsed.data.emoji || '📦',
        sortOrder,
        customFields: parsed.data.customFields && parsed.data.customFields.length > 0 
          ? parsed.data.customFields 
          : [],
      });

      const saved = await categoryRepo.save(category);
      return NextResponse.json({ 
        category: {
          ...saved,
          customFields: saved.customFields || [],
        }
      }, { status: 201 });
    });
  } catch (error: any) {
    if (error.message === 'Категория с таким названием уже существует') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Error creating category:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - обновить категорию
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ message: 'Category ID required' }, { status: 400 });
  }

  const parsed = updateCategorySchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  try {
    return await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);

      const category = await categoryRepo.findOne({
        where: { id, shopId: session.shopId },
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Проверка на дубликат названия (если название изменяется)
      if (parsed.data.name && parsed.data.name !== category.name) {
        const existing = await categoryRepo.findOne({
          where: { shopId: session.shopId, name: parsed.data.name },
        });

        if (existing) {
          throw new Error('Категория с таким названием уже существует');
        }
      }

      // Обновляем поля
      if (parsed.data.name !== undefined) category.name = parsed.data.name;
      if (parsed.data.emoji !== undefined) category.emoji = parsed.data.emoji;
      if (parsed.data.sortOrder !== undefined) category.sortOrder = parsed.data.sortOrder;
      if (parsed.data.customFields !== undefined) {
        category.customFields = parsed.data.customFields && parsed.data.customFields.length > 0
          ? parsed.data.customFields
          : [];
      }

      const saved = await categoryRepo.save(category);
      return NextResponse.json({ 
        category: {
          ...saved,
          customFields: saved.customFields || [],
        }
      });
    });
  } catch (error: any) {
    if (error.message === 'Category not found') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error.message === 'Категория с таким названием уже существует') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Error updating category:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - удалить категорию
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Category ID required' }, { status: 400 });
  }

  const ds = await getDataSource();

  try {
    return await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);
      const brandRepo = em.getRepository(BrandEntity);

      const category = await categoryRepo.findOne({
        where: { id, shopId: session.shopId },
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Проверяем, есть ли связанные бренды
      const brandsCount = await brandRepo.count({
        where: { categoryId: id },
      });

      if (brandsCount > 0) {
        throw new Error(
          `Невозможно удалить категорию: в ней есть ${brandsCount} бренд(ов). Сначала удалите или переместите все бренды из этой категории.`
        );
      }

      await categoryRepo.remove(category);
      return NextResponse.json({ success: true });
    });
  } catch (error: any) {
    if (error.message === 'Category not found') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error.message.includes('Невозможно удалить категорию')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Error deleting category:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
