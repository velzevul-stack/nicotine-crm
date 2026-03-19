import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { BrandEntity } from '@/lib/db/entities';
import { z } from 'zod';

const reorderCategorySchema = z.object({
  categoryId: z.string().uuid(),
  brandIds: z.array(z.string().uuid()), // Массив ID брендов в новом порядке
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = reorderCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  try {
    return await ds.transaction(async (em) => {
      const brandRepo = em.getRepository(BrandEntity);

      // Получаем все бренды категории
      const brands = await brandRepo.find({
        where: {
          shopId: session.shopId,
          categoryId: parsed.data.categoryId,
        },
        order: { sortOrder: 'ASC', name: 'ASC' },
      });

      // Проверяем, что все переданные ID существуют
      const brandMap = new Map(brands.map(b => [b.id, b]));
      for (const id of parsed.data.brandIds) {
        if (!brandMap.has(id)) {
          return NextResponse.json(
            { message: `Brand ${id} not found in category` },
            { status: 404 }
          );
        }
      }

      // Обновляем sortOrder для всех брендов в новом порядке
      const updates = parsed.data.brandIds.map((id, index) => {
        const brand = brandMap.get(id)!;
        brand.sortOrder = index + 1;
        return brandRepo.save(brand);
      });

      await Promise.all(updates);

      return NextResponse.json({
        success: true,
        message: `Updated sortOrder for ${parsed.data.brandIds.length} brands`,
      });
    });
  } catch (error: any) {
    console.error('Error reordering category brands:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
