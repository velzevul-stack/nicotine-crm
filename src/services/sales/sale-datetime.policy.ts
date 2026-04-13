/** Строка даты/времени из API: без таймзоны дополняется `:00` как в прежнем route/service. */
export function parseApiFlexibleDatetime(dateStr: string): Date {
  return new Date(dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr}:00`);
}
