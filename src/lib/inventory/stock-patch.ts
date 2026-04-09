import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import {
  FlavorEntity,
  StockItemEntity,
  StockMovementActionType,
  StockMovementContextType,
  StockZone,
} from '@/lib/db/entities';
import { logStockMovement } from '@/lib/stock-movement-log';

export const stockUpdateSchema = z.object({
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

export type StockUpdatePayload = z.infer<typeof stockUpdateSchema>;

export class StockPatchHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'StockPatchHttpError';
  }
}

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

function inferZonesByDelta(
  warehouseDelta: number,
  postDelta: number
): { fromZone: StockZone | null; toZone: StockZone | null } {
  if (warehouseDelta > 0 && postDelta > 0) return { fromZone: null, toZone: 'warehouse' };
  if (warehouseDelta < 0 && postDelta < 0) return { fromZone: 'warehouse', toZone: null };
  if (warehouseDelta === 0 && postDelta > 0) return { fromZone: 'warehouse', toZone: 'post' };
  if (warehouseDelta === 0 && postDelta < 0) return { fromZone: 'post', toZone: 'warehouse' };
  if (warehouseDelta > 0 && postDelta === 0) return { fromZone: null, toZone: 'warehouse' };
  if (warehouseDelta < 0 && postDelta === 0) return { fromZone: 'warehouse', toZone: null };
  return { fromZone: null, toZone: null };
}

/**
 * Одна правка остатка внутри уже открытой транзакции (с блокировкой строки stock_items).
 */
export async function applyStockPatchInTransaction(
  em: EntityManager,
  shopId: string,
  parsed: StockUpdatePayload
): Promise<StockItemEntity> {
  const flavor = await em.getRepository(FlavorEntity).findOne({
    where: { id: parsed.flavorId, shopId },
  });

  if (!flavor) {
    throw new StockPatchHttpError(404, 'Товар не найден или не принадлежит вашему магазину');
  }

  const stockRepo = em.getRepository(StockItemEntity);
  let item = await stockRepo.findOne({
    where: { shopId, flavorId: parsed.flavorId },
    lock: { mode: 'pessimistic_write' },
  });

  const explicitPost = parsed.postQuantity !== undefined;
  const warehouseReceiptNoExplicitPost =
    parsed.actionType === 'receipt_to_warehouse' && !explicitPost;

  if (!item) {
    const initialPost = warehouseReceiptNoExplicitPost
      ? (parsed.postQuantity ?? 0)
      : (parsed.postQuantity ?? parsed.quantity);
    item = stockRepo.create({
      shopId,
      flavorId: parsed.flavorId,
      quantity: parsed.quantity,
      postQuantity: initialPost,
      costPrice: parsed.costPrice ?? 0,
    });
  } else {
    if (parsed.costPrice !== undefined) {
      item.costPrice = parsed.costPrice;
    }
  }

  const beforeQty = item.id ? Math.max(0, item.quantity) : 0;
  const beforePostQty = item.id ? Math.max(0, item.postQuantity ?? 0) : 0;
  const afterQty = parsed.quantity;
  const afterPostQty = warehouseReceiptNoExplicitPost
    ? beforePostQty
    : (parsed.postQuantity ?? Math.max(0, beforePostQty + (afterQty - beforeQty)));
  const warehouseDelta = afterQty - beforeQty;
  const postDelta = afterPostQty - beforePostQty;
  const movementQty = Math.abs(warehouseDelta) > 0 ? Math.abs(warehouseDelta) : Math.abs(postDelta);
  const inferredAction: StockMovementActionType =
    warehouseDelta < 0 || postDelta < 0
      ? 'manual_decrease'
      : warehouseDelta > 0 || postDelta > 0
        ? 'manual_transfer'
        : 'manual_transfer';
  const actionType = parsed.actionType ?? inferredAction;
  const inferredZones = inferZonesByAction(actionType);
  const deltaZones = inferZonesByDelta(warehouseDelta, postDelta);
  const fromZone: StockZone | null =
    parsed.fromZone !== undefined
      ? parsed.fromZone
      : actionType === 'manual_transfer'
        ? deltaZones.fromZone
        : inferredZones.fromZone;
  const toZone: StockZone | null =
    parsed.toZone !== undefined
      ? parsed.toZone
      : actionType === 'manual_transfer'
        ? deltaZones.toZone
        : inferredZones.toZone;

  item.quantity = afterQty;
  item.postQuantity = afterPostQty;
  await stockRepo.save(item);

  if (warehouseDelta !== 0 || postDelta !== 0) {
    const movementComment = [
      parsed.comment,
      warehouseReceiptNoExplicitPost ? 'Витрина не изменена (приём на склад)' : null,
    ]
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .join(' · ');
    await logStockMovement(em, {
      shopId,
      productId: parsed.flavorId,
      actionType,
      fromZone,
      toZone,
      quantity: movementQty,
      postStockBefore: beforePostQty,
      postStockAfter: afterPostQty,
      warehouseBefore: beforeQty,
      warehouseAfter: afterQty,
      contextType: (parsed.contextType as StockMovementContextType | undefined) ?? null,
      contextId: parsed.contextId ?? null,
      comment: movementComment || null,
    });
  }

  return item;
}

export const warehouseReceiveBatchItemSchema = z.object({
  flavorId: z.string().uuid(),
  quantity: z.number().int().min(0),
  costPrice: z.number().finite().min(0).optional(),
  comment: z.string().nullable().optional(),
});

export const warehouseReceiveBatchSchema = z.object({
  items: z.array(warehouseReceiveBatchItemSchema).min(1).max(300),
});
