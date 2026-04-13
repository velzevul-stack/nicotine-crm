import type { StockItem } from '@/lib/db/entities';
import { InsufficientStockError } from '@/services/common/domain-errors';

export function getWarehouseAvailable(stock: StockItem | null): number {
  return Math.max(0, (stock?.quantity ?? 0) - (stock?.reservedQuantity ?? 0));
}

export function getPostAvailable(stock: StockItem | null): number {
  return Math.max(0, stock?.postQuantity ?? 0);
}

/** Количество, доступное для продажи/резерва на одной строке (расходники vs остальные). */
export function getAvailableForSaleLine(isConsumable: boolean, stock: StockItem | null): number {
  const warehouseAvailable = getWarehouseAvailable(stock);
  const postAvailable = getPostAvailable(stock);
  const sellableNonCon =
    postAvailable <= 0 ? warehouseAvailable : Math.min(warehouseAvailable, postAvailable);
  return isConsumable ? warehouseAvailable : sellableNonCon;
}

export function assertLineStockAvailable(params: {
  flavorNameSnapshot: string;
  quantity: number;
  isConsumable: boolean;
  stock: StockItem | null;
  isReservation: boolean;
  /** create — как при создании чека; update — короткое сообщение как в ветке редактирования */
  wording: 'create' | 'update';
}): void {
  const available = getAvailableForSaleLine(params.isConsumable, params.stock);
  if (available >= params.quantity) return;

  let message: string;
  if (params.wording === 'update') {
    message = `Недостаточно товара: ${params.flavorNameSnapshot} (доступно ${available})`;
  } else if (params.isReservation) {
    message = `Недостаточно товара для резерва: ${params.flavorNameSnapshot} (доступно ${available})`;
  } else {
    message = `Недостаточно товара: ${params.flavorNameSnapshot} (доступно ${available})`;
  }
  throw new InsufficientStockError(message);
}

// --- Чистые переходы количеств (остаток после применения к объекту stock в сервисе) ---

/** Отмена строки резерва при редактировании чека (всегда возвращаем пост на пост). */
export function quantitiesAfterEditUndoReservationLine(
  postQty: number,
  reservedQty: number,
  lineQty: number,
): { reservedQuantity: number; postQuantity: number } {
  return {
    reservedQuantity: Math.max(0, reservedQty - lineQty),
    postQuantity: postQty + lineQty,
  };
}

/** Отмена обычной продажи при редактировании. */
export function quantitiesAfterEditUndoWarehouseSaleLine(
  warehouseQty: number,
  postQty: number,
  lineQty: number,
): { quantity: number; postQuantity: number } {
  return {
    quantity: warehouseQty + lineQty,
    postQuantity: postQty + lineQty,
  };
}

/** Новая строка резерва: резерв↑, с поста списываем. */
export function quantitiesAfterApplyReservationLine(
  postQty: number,
  reservedQty: number,
  lineQty: number,
): { reservedQuantity: number; postQuantity: number } {
  return {
    reservedQuantity: reservedQty + lineQty,
    postQuantity: Math.max(0, postQty - lineQty),
  };
}

/** Новая строка продажи со склада; расходники не трогают пост. */
export function quantitiesAfterApplyWarehouseSaleLine(
  warehouseQty: number,
  postQty: number,
  lineQty: number,
  isConsumableFlavor: boolean,
): { quantity: number; postQuantity: number } {
  return {
    quantity: warehouseQty - lineQty,
    postQuantity: isConsumableFlavor ? postQty : Math.max(0, postQty - lineQty),
  };
}

/** Удаление чека: отмена резерва (пост возвращаем только для нерасходников). */
export function quantitiesAfterDeleteUndoReservationLine(
  postQty: number,
  reservedQty: number,
  lineQty: number,
  isConsumableFlavor: boolean,
): { reservedQuantity: number; postQuantity: number } {
  return {
    reservedQuantity: Math.max(0, reservedQty - lineQty),
    postQuantity: isConsumableFlavor ? postQty : postQty + lineQty,
  };
}

/** Удаление чека: отмена продажи со склада. */
export function quantitiesAfterDeleteUndoWarehouseSaleLine(
  warehouseQty: number,
  postQty: number,
  lineQty: number,
  isConsumableFlavor: boolean,
): { quantity: number; postQuantity: number } {
  return {
    quantity: warehouseQty + lineQty,
    postQuantity: isConsumableFlavor ? postQty : postQty + lineQty,
  };
}
