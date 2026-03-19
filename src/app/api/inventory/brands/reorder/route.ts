import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { BrandEntity } from '@/lib/db/entities';
import { z } from 'zod';

const reorderSchema = z.object({
  brandId1: z.string().uuid(),
  brandId2: z.string().uuid(),
  sortOrder1: z.number().int(),
  sortOrder2: z.number().int(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);

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

      // Получаем оба бренда в одной транзакции
      const [brand1, brand2] = await Promise.all([
        brandRepo.findOne({
          where: { id: parsed.data.brandId1, shopId: session.shopId },
        }),
        brandRepo.findOne({
          where: { id: parsed.data.brandId2, shopId: session.shopId },
        }),
      ]);

      if (!brand1 || !brand2) {
        return NextResponse.json(
          { message: 'One or both brands not found' },
          { status: 404 }
        );
      }

      // Проверяем, что бренды из одной категории
      if (brand1.categoryId !== brand2.categoryId) {
        return NextResponse.json(
          { message: 'Brands must be from the same category' },
          { status: 400 }
        );
      }

      // Меняем местами sortOrder
      const oldSortOrder1 = brand1.sortOrder;
      const oldSortOrder2 = brand2.sortOrder;
      
      brand1.sortOrder = parsed.data.sortOrder1;
      brand2.sortOrder = parsed.data.sortOrder2;

      console.log('Reordering brands:', {
        brand1: { id: brand1.id, name: brand1.name, old: oldSortOrder1, new: brand1.sortOrder },
        brand2: { id: brand2.id, name: brand2.name, old: oldSortOrder2, new: brand2.sortOrder },
      });

      // Сохраняем оба бренда последовательно для надежности
      await brandRepo.save(brand1);
      await brandRepo.save(brand2);

      // Проверяем, что данные сохранились
      const [savedBrand1, savedBrand2] = await Promise.all([
        brandRepo.findOne({ where: { id: brand1.id } }),
        brandRepo.findOne({ where: { id: brand2.id } }),
      ]);

      return NextResponse.json({
        success: true,
        brand1: { id: brand1.id, name: brand1.name, sortOrder: savedBrand1?.sortOrder ?? brand1.sortOrder },
        brand2: { id: brand2.id, name: brand2.name, sortOrder: savedBrand2?.sortOrder ?? brand2.sortOrder },
      });
    });
  } catch (error: any) {
    console.error('Error reordering brands:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
