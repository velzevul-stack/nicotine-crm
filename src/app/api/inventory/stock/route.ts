import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { StockItemEntity, FlavorEntity, StockMovementActionType, StockMovementContextType, StockZone } from '@/lib/db/entities';
import { z } from 'zod';
import { logStockMovement } from '@/lib/stock-movement-log';

const updateSchema = z.object({
  flavorId: z.string().uuid(),
  quantity: z.number().int().min(0),
  postQuantity: z.number().int().min(0).optional(),
  costPrice: z.number().finite().min(0, { message: 'Закупочная цена не может быть отрицательной' }).optional(),
  actionType: z
    .enum([
      'receipt_to_post',
      'receipt_to_warehouse',
      'sale',
      'reservation_sale',
      'debt_sale',
      'cancel_sale',
      'manual_transfer',
      'manual_decrease',
      'clear_stock',
    ])
    .optional(),
  fromZone: z.enum(['post', 'warehouse']).nullable().optional(),
  toZone: z.enum(['post', 'warehouse']).nullable().optional(),
  contextType: z.enum(['sale', 'debt', 'reservation']).nullable().optional(),
  contextId: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

function inferZonesByAction(actionType: StockMovementActionType): {
  fromZone: StockZone | null;
  toZone: StockZone | null;
} {
  switch (actionType) {
    case 'receipt_to_post':
      return { fromZone: null, toZone: 'post' };
    case 'receipt_to_warehouse':
      return { fromZone: null, toZone: 'warehouse' };
    case 'sale':
    case 'debt_sale':
    case 'reservation_sale':
    case 'manual_decrease':
    case 'clear_stock':
      return { fromZone: 'warehouse', toZone: null };
    case 'cancel_sale':
      return { fromZone: null, toZone: 'warehouse' };
    case 'manual_transfer':
      return { fromZone: null, toZone: 'warehouse' };
    default:
      return { fromZone: null, toZone: null };
  }
}

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
        postQuantity: parsed.data.postQuantity ?? parsed.data.quantity,
        costPrice: parsed.data.costPrice ?? 0,
      });
    } else {
      if (parsed.data.costPrice !== undefined) {
        item.costPrice = parsed.data.costPrice;
      }
    }

    const beforeQty = item.id ? Math.max(0, item.quantity) : 0;
    const beforePostQty = item.id ? Math.max(0, item.postQuantity ?? 0) : 0;
    const afterQty = parsed.data.quantity;
    const afterPostQty = parsed.data.postQuantity ?? afterQty;
    const warehouseDelta = afterQty - beforeQty;
    const postDelta = afterPostQty - beforePostQty;
    const movementQty = Math.abs(warehouseDelta) > 0 ? Math.abs(warehouseDelta) : Math.abs(postDelta);
    const inferredAction: StockMovementActionType =
      warehouseDelta < 0 || postDelta < 0
        ? 'manual_decrease'
        : warehouseDelta > 0 || postDelta > 0
          ? 'manual_transfer'
          : 'manual_transfer';
    const actionType = parsed.data.actionType ?? inferredAction;
    const inferredZones = inferZonesByAction(actionType);
    const fromZone: StockZone | null =
      parsed.data.fromZone !== undefined ? parsed.data.fromZone : inferredZones.fromZone;
    const toZone: StockZone | null =
      parsed.data.toZone !== undefined ? parsed.data.toZone : inferredZones.toZone;

    item.quantity = afterQty;
    item.postQuantity = afterPostQty;
    await stockRepo.save(item);

    if (warehouseDelta !== 0 || postDelta !== 0) {
      await logStockMovement(em, {
        shopId: session.shopId,
        productId: parsed.data.flavorId,
        actionType,
        fromZone,
        toZone,
        quantity: movementQty,
        postStockBefore: beforePostQty,
        postStockAfter: afterPostQty,
        warehouseBefore: beforeQty,
        warehouseAfter: afterQty,
        contextType: (parsed.data.contextType as StockMovementContextType | undefined) ?? null,
        contextId: parsed.data.contextId ?? null,
        comment: parsed.data.comment ?? null,
      });
    }
    return NextResponse.json(item);
  });
}
