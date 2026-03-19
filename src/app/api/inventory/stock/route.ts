import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { StockItemEntity, FlavorEntity } from '@/lib/db/entities';
import { z } from 'zod';

const updateSchema = z.object({
  flavorId: z.string().uuid(),
  quantity: z.number().int().min(0),
  costPrice: z.number().min(0).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  return ds.transaction(async (em) => {
    // Проверяем, что flavor принадлежит правильному магазину
    const flavor = await em.getRepository(FlavorEntity).findOne({
      where: { id: parsed.data.flavorId, shopId: session.shopId },
    });

    if (!flavor) {
      return NextResponse.json(
        { message: 'Товар не найден или не принадлежит вашему магазину' },
        { status: 404 }
      );
    }

    const stockRepo = em.getRepository(StockItemEntity);
    let item = await stockRepo.findOne({
      where: { shopId: session.shopId, flavorId: parsed.data.flavorId },
    });

    if (!item) {
      item = stockRepo.create({
        shopId: session.shopId,
        flavorId: parsed.data.flavorId,
        quantity: parsed.data.quantity,
        costPrice: parsed.data.costPrice ?? 0,
      });
    } else {
      item.quantity = parsed.data.quantity;
      if (parsed.data.costPrice !== undefined) {
        item.costPrice = parsed.data.costPrice;
      }
    }

    await stockRepo.save(item);
    return NextResponse.json(item);
  });
}
