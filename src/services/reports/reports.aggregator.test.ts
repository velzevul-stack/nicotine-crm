import { describe, expect, it } from 'vitest';
import {
  clampInt,
  endOfCalendarDayUtc,
  resolveReportPeriod,
  startOfCalendarDayUtc,
  toNumber,
  YMD_RE,
} from '@/services/reports/reports.aggregator';

describe('resolveReportPeriod', () => {
  const tz = 'Europe/Minsk';
  const fixed = new Date('2024-06-15T12:00:00.000Z');

  it('uses explicit YMD range', () => {
    const { from, to } = resolveReportPeriod({
      daysParam: null,
      fromParam: '2024-06-01',
      toParam: '2024-06-02',
      timeZone: tz,
      now: fixed,
    });
    expect(from.getTime()).toBe(startOfCalendarDayUtc('2024-06-01', tz).getTime());
    expect(to.getTime()).toBe(endOfCalendarDayUtc('2024-06-02', tz).getTime());
  });

  it('swaps inverted YMD', () => {
    const a = resolveReportPeriod({
      daysParam: null,
      fromParam: '2024-06-10',
      toParam: '2024-06-01',
      timeZone: tz,
      now: fixed,
    });
    const b = resolveReportPeriod({
      daysParam: null,
      fromParam: '2024-06-01',
      toParam: '2024-06-10',
      timeZone: tz,
      now: fixed,
    });
    expect(a.from.getTime()).toBe(b.from.getTime());
    expect(a.to.getTime()).toBe(b.to.getTime());
  });

  it('respects days=all with fixed now', () => {
    const { from, to } = resolveReportPeriod({
      daysParam: 'all',
      fromParam: null,
      toParam: null,
      timeZone: tz,
      now: fixed,
    });
    expect(from.getTime()).toBe(startOfCalendarDayUtc('2020-01-01', tz).getTime());
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe('helpers', () => {
  it('toNumber', () => {
    expect(toNumber('12', 0)).toBe(12);
    expect(toNumber('x', 7)).toBe(7);
  });
  it('clampInt', () => {
    expect(clampInt(500, 1, 365)).toBe(365);
  });
  it('YMD_RE', () => {
    expect(YMD_RE.test('2024-01-02')).toBe(true);
    expect(YMD_RE.test('24-01-02')).toBe(false);
  });
});
