export const PRICE_EPS = 0.005;

export const emptyToUndefined = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : v;

export function normalizeName(v: string): string {
  return v.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function normalizeNameKey(v: string): string {
  return normalizeName(v).toLowerCase();
}

export function normalizeBarcode(v: string): string {
  return v.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();
}
