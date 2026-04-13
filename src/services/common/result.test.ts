import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, unwrapOr } from '@/services/common/result';

describe('result', () => {
  it('ok / isOk / unwrapOr', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    expect(unwrapOr(r, 0)).toBe(42);
  });

  it('err / isErr / unwrapOr fallback', () => {
    const r = err('bad');
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    expect(unwrapOr(r, 0)).toBe(0);
  });
});
