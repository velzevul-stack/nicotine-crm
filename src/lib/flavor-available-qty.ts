/** Доступно к продаже / резерву: остаток минус уже зарезервированное. */
export function flavorAvailableQuantity(flavor: {
  quantity?: number | null;
  reservedQuantity?: number | null;
}): number {
  const q = Number(flavor.quantity) || 0;
  const r = Number(flavor.reservedQuantity) || 0;
  return Math.max(0, q - r);
}
