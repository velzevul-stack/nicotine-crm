import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/services/common/domain-errors';
import {
  assertDiscountNotExceedsGoods,
  assertSplitPaymentTotals,
  cashCardForSimplePaymentType,
  computeDiscountAmount,
  computeFinalAmount,
  finalAmountAfterDeliveryOnlyChange,
  patchSalePricingForDeliveryOnly,
  resolveCashCardAfterPaymentTypeChangeOnEdit,
  resolveCreatePaymentAmounts,
  sumLineTotals,
} from '@/services/sales/pricing.policy';

describe('sumLineTotals', () => {
  it('sums lineTotal', () => {
    expect(sumLineTotals([{ lineTotal: 10 }, { lineTotal: 2.5 }])).toBe(12.5);
  });
});

describe('computeDiscountAmount', () => {
  it('caps percent discount at total', () => {
    expect(computeDiscountAmount(100, 200, 'percent')).toBe(100);
  });
  it('caps absolute discount at total', () => {
    expect(computeDiscountAmount(50, 80, 'absolute')).toBe(50);
  });
  it('applies percent under cap', () => {
    expect(computeDiscountAmount(200, 10, 'percent')).toBe(20);
  });
});

describe('computeFinalAmount', () => {
  it('never returns negative', () => {
    expect(computeFinalAmount(10, 50, 0)).toBe(0);
  });
  it('adds delivery', () => {
    expect(computeFinalAmount(100, 10, 5)).toBe(95);
  });
});

describe('assertDiscountNotExceedsGoods', () => {
  it('throws when discount above total', () => {
    expect(() => assertDiscountNotExceedsGoods(10, 11)).toThrow(ValidationError);
  });
  it('passes when equal', () => {
    expect(() => assertDiscountNotExceedsGoods(10, 10)).not.toThrow();
  });
});

describe('assertSplitPaymentTotals', () => {
  it('accepts within epsilon', () => {
    expect(() => assertSplitPaymentTotals(33.33, 66.67, 100)).not.toThrow();
  });
  it('throws when mismatch', () => {
    expect(() => assertSplitPaymentTotals(10, 10, 100)).toThrow(ValidationError);
  });
});

describe('resolveCreatePaymentAmounts', () => {
  it('maps cash to full final', () => {
    expect(resolveCreatePaymentAmounts({ paymentType: 'cash', finalAmount: 42 })).toEqual({
      cashAmount: 42,
      cardAmount: 0,
    });
  });
  it('requires customer for debt', () => {
    expect(() =>
      resolveCreatePaymentAmounts({ paymentType: 'debt', finalAmount: 10, customerName: '  ' }),
    ).toThrow(ValidationError);
  });
  it('validates split', () => {
    expect(() =>
      resolveCreatePaymentAmounts({
        paymentType: 'split',
        finalAmount: 100,
        cashAmount: 40,
        cardAmount: 50,
        customerName: null,
      }),
    ).toThrow(ValidationError);
  });
});

describe('patchSalePricingForDeliveryOnly', () => {
  it('updates cash for cash payment', () => {
    const p = patchSalePricingForDeliveryOnly({
      paymentType: 'cash',
      totalAmount: 100,
      storedDiscountAmount: 10,
      newDeliveryAmount: 5,
      currentCash: 95,
      currentCard: 0,
    });
    expect(p.finalAmount).toBe(95);
    expect(p.cashAmount).toBe(95);
    expect(p.cardAmount).toBe(0);
  });
  it('keeps split amounts when payment is split', () => {
    const p = patchSalePricingForDeliveryOnly({
      paymentType: 'split',
      totalAmount: 100,
      storedDiscountAmount: 0,
      newDeliveryAmount: 10,
      currentCash: 60,
      currentCard: 50,
    });
    expect(p.finalAmount).toBe(110);
    expect(p.cashAmount).toBe(60);
    expect(p.cardAmount).toBe(50);
  });
});

describe('resolveCashCardAfterPaymentTypeChangeOnEdit', () => {
  it('sets card for card type', () => {
    expect(
      resolveCashCardAfterPaymentTypeChangeOnEdit({
        nextPaymentType: 'card',
        finalAmount: 200,
        saleCash: 200,
        saleCard: 0,
      }),
    ).toEqual({ cashAmount: 0, cardAmount: 200 });
  });
});

describe('finalAmountAfterDeliveryOnlyChange', () => {
  it('matches stored discount semantics', () => {
    expect(finalAmountAfterDeliveryOnlyChange(100, 20, 10)).toBe(90);
  });
});
