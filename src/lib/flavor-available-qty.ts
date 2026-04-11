/** Доступно к продаже / резерву: остаток минус уже зарезервированное. */
export function flavorAvailableQuantity(flavor: {
  quantity?: number | null;
  postQuantity?: number | null;
  reservedQuantity?: number | null;
  /** Расходники: на витрине не ведём учёт — продаём со склада (postQuantity может быть 0). */
  isConsumableCategory?: boolean;
}): number {
  const q = Number(flavor.quantity) || 0;
  const p = Number(flavor.postQuantity) || 0;
  const r = Number(flavor.reservedQuantity) || 0;
  const warehouseFree = Math.max(0, q - r);
  if (flavor.isConsumableCategory) {
    return warehouseFree;
  }
  return Math.max(0, Math.min(p, warehouseFree));
}
