/**
 * Хост PostgreSQL из env. Строка "localhost" в Node часто резолвится в ::1 (IPv6),
 * а проверку `psql -h 127.0.0.1` делают по IPv4 — в pg_hba могут быть разные правила.
 * Явный 127.0.0.1 совпадает с типичной ручной проверкой на VPS.
 */
export function resolveDbHost(): string {
  const h = (process.env.DB_HOST ?? 'localhost').trim().replace(/\r/g, '');
  if (h === 'localhost' || h === '::1') {
    return '127.0.0.1';
  }
  return h;
}
