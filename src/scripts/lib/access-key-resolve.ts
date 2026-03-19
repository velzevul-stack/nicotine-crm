/**
 * Варианты ключа для поиска в БД (как в /api/auth/key).
 */
export function accessKeySearchCandidates(input: string): string[] {
  const t = input.trim();
  if (!t) return [];
  const variants = new Set<string>();
  variants.add(t);
  const u = t.toUpperCase();
  variants.add(u);
  if (u.startsWith('KEY-')) {
    variants.add(t.slice(4));
    variants.add(u.slice(4));
  } else {
    variants.add(`KEY-${u}`);
  }
  return [...variants];
}
