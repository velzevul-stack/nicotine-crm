import { describe, expect, it } from 'vitest';
import { sumDebtOperationAmountsByDebtId } from '@/services/sales/debt.policy';

describe('sumDebtOperationAmountsByDebtId', () => {
  it('aggregates by debt', () => {
    const m = sumDebtOperationAmountsByDebtId([
      { debtId: 'a', amount: 10 },
      { debtId: 'b', amount: 5 },
      { debtId: 'a', amount: 3 },
    ]);
    expect(m.get('a')).toBe(13);
    expect(m.get('b')).toBe(5);
  });
});
