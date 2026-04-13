import { describe, expect, it } from 'vitest';
import { parseApiFlexibleDatetime } from '@/services/sales/sale-datetime.policy';

describe('parseApiFlexibleDatetime', () => {
  it('appends seconds when no timezone', () => {
    const d = parseApiFlexibleDatetime('2024-06-01T12:30');
    expect(d.getUTCHours()).toBeDefined();
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
  it('parses ISO with Z', () => {
    const d = parseApiFlexibleDatetime('2024-06-01T10:00:00.000Z');
    expect(d.toISOString()).toBe('2024-06-01T10:00:00.000Z');
  });
});
