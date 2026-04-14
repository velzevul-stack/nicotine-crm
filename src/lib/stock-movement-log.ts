import { EntityManager, In } from 'typeorm';
import {
  BrandEntity,
  FlavorEntity,
  ProductFormatEntity,
  StockMovementActionType,
  StockMovementContextType,
  StockMovementEntity,
  StockZone,
  type StockMovement,
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

/**
 * Одна строка «линейка» без повторения названия бренда, если оно уже входит в имя формата
 * (в БД часто format.name = "{brand} {крепость}" или совпадает с brand.name).
 */
export function formatStockProductDisplayLabel(parts: {
  brandName?: string | null;
  formatName?: string | null;
  flavorName?: string | null;
}): string {
  const b = (parts.brandName ?? '').trim();
  const f = (parts.formatName ?? '').trim();
  const v = (parts.flavorName ?? '').trim();
  let line = '';
  if (f) {
    if (b && (f === b || f.startsWith(`${b} `))) {
      line = f;
    } else if (b) {
      line = `${b} ${f}`;
    } else {
      line = f;
    }
  } else {
    line = b;
  }
  return [line, v].filter(Boolean).join(' ');
}

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
  return formatStockProductDisplayLabel({
    brandName: brand?.name ?? null,
    formatName: format?.name ?? null,
    flavorName: flavor.name ?? null,
  });
}

/** Пересчитать подпись товара для списка движений (в т.ч. старые записи со снимком-дубликатом). */
export async function hydrateStockMovementProductLabels(
  em: EntityManager,
  shopId: string,
  rows: StockMovement[],
): Promise<StockMovement[]> {
  if (rows.length === 0) return rows;
  const flavorIds = [...new Set(rows.map((r) => r.productId))];
  const flavors = await em.getRepository(FlavorEntity).find({
    where: { shopId, id: In(flavorIds) },
  });
  const flavorById = new Map(flavors.map((x) => [x.id, x]));
  const formatIds = [...new Set(flavors.map((x) => x.productFormatId).filter(Boolean))] as string[];
  const formats = formatIds.length
    ? await em.getRepository(ProductFormatEntity).find({ where: { shopId, id: In(formatIds) } })
    : [];
  const formatById = new Map(formats.map((x) => [x.id, x]));
  const brandIds = [...new Set(formats.map((x) => x.brandId).filter(Boolean))] as string[];
  const brands = brandIds.length
    ? await em.getRepository(BrandEntity).find({ where: { shopId, id: In(brandIds) } })
    : [];
  const brandById = new Map(brands.map((x) => [x.id, x]));

  return rows.map((row) => {
    const flavor = flavorById.get(row.productId);
    if (!flavor) return row;
    const format = formatById.get(flavor.productFormatId);
    const brand = format ? brandById.get(format.brandId) : undefined;
    const productName = formatStockProductDisplayLabel({
      brandName: brand?.name ?? null,
      formatName: format?.name ?? null,
      flavorName: flavor.name ?? null,
    });
    return { ...row, productName };
  });
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
