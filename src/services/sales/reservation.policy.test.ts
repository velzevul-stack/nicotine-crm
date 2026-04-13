import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/services/common/domain-errors';
import { assertReservationRulesForCreate, RESERVATION_MIN_LEAD_MS } from '@/services/sales/reservation.policy';

describe('assertReservationRulesForCreate', () => {
  const now = 1_000_000_000_000;

  it('no-op when not reservation', () => {
    expect(() => assertReservationRulesForCreate(false, null, now)).not.toThrow();
  });
  it('throws without expiry', () => {
    expect(() => assertReservationRulesForCreate(true, null, now)).toThrow(ValidationError);
  });
  it('throws when expiry too soon', () => {
    const iso = new Date(now + 30_000).toISOString();
    expect(() => assertReservationRulesForCreate(true, iso, now)).toThrow(ValidationError);
  });
  it('passes when expiry after lead', () => {
    const iso = new Date(now + RESERVATION_MIN_LEAD_MS + 60_000).toISOString();
    expect(() => assertReservationRulesForCreate(true, iso, now)).not.toThrow();
  });
});
