import { ValidationError } from '@/services/common/domain-errors';

export const RESERVATION_MIN_LEAD_MS = 60_000;

/** Правила даты окончания резерва при создании продажи (после Zod). */
export function assertReservationRulesForCreate(
  isReservation: boolean,
  reservationExpiry: string | null | undefined,
  nowMs: number = Date.now(),
): void {
  if (!isReservation) return;

  if (!reservationExpiry) {
    throw new ValidationError('Укажите дату и время окончания резерва', undefined, {
      code: 'INVALID_RESERVATION',
    });
  }
  const exp = new Date(reservationExpiry);
  if (Number.isNaN(exp.getTime())) {
    throw new ValidationError('Некорректная дата окончания резерва', undefined, {
      code: 'INVALID_RESERVATION_DATE',
    });
  }
  if (exp.getTime() <= nowMs + RESERVATION_MIN_LEAD_MS) {
    throw new ValidationError(
      'Резерв должен заканчиваться позже текущего времени (минимум на 1 минуту)',
      undefined,
      { code: 'INVALID_RESERVATION_LEAD' },
    );
  }
}
