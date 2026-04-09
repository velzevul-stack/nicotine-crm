import { EntityManager } from 'typeorm';
import {
  BrandEntity,
  FlavorEntity,
  ProductFormatEntity,
  StockMovementActionType,
  StockMovementContextType,
  StockMovementEntity,
  StockZone,
} from '@/lib/db/entities';

type LogStockMovementInput = {
  shopId: string;
  productId: string;
  productName?: string;
  actionType: StockMovementActionType;
  fromZone?: StockZone | null;
  toZone?: StockZone | null;
  quantity: number;
  postStockBefore?: number;
  postStockAfter?: number;
  warehouseBefore: number;
  warehouseAfter: number;
  contextType?: StockMovementContextType;
  contextId?: string | null;
  comment?: string | null;
};

export async function resolveProductUiName(
  em: EntityManager,
  shopId: string,
  flavorId: string,
): Promise<string> {
  const flavor = await em.getRepository(FlavorEntity).findOne({
    where: { id: flavorId, shopId },
  });
  if (!flavor) return flavorId;
  const format = await em.getRepository(ProductFormatEntity).findOne({
    where: { id: flavor.productFormatId, shopId },
  });
  const brand = format
    ? await em.getRepository(BrandEntity).findOne({ where: { id: format.brandId, shopId } })
    : null;
  const parts = [brand?.name, format?.name, flavor.name].filter(Boolean);
  return parts.join(' ');
}

export async function logStockMovement(
  em: EntityManager,
  input: LogStockMovementInput,
): Promise<void> {
  const productName =
    input.productName ?? (await resolveProductUiName(em, input.shopId, input.productId));
  const movement = em.getRepository(StockMovementEntity).create({
    shopId: input.shopId,
    productId: input.productId,
    productName,
    actionType: input.actionType,
    fromZone: input.fromZone ?? null,
    toZone: input.toZone ?? null,
    quantity: Math.max(0, Math.trunc(input.quantity)),
    postStockBefore: Math.max(0, Math.trunc(input.postStockBefore ?? 0)),
    postStockAfter: Math.max(0, Math.trunc(input.postStockAfter ?? 0)),
    warehouseBefore: Math.max(0, Math.trunc(input.warehouseBefore)),
    warehouseAfter: Math.max(0, Math.trunc(input.warehouseAfter)),
    contextType: input.contextType ?? null,
    contextId: input.contextId ?? null,
    comment: input.comment ?? null,
  });
  await em.getRepository(StockMovementEntity).save(movement);
}
