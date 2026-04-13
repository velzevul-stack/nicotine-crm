import { ValidationError } from '@/services/common/domain-errors';

export const SPLIT_PAYMENT_EPSILON = 0.01;

export type SalePaymentType = 'cash' | 'card' | 'split' | 'debt';

export function sumLineTotals(items: { lineTotal: number }[]): number {
  return items.reduce((s, i) => s + i.lineTotal, 0);
}

export function computeDiscountAmount(
  totalAmount: number,
  discountValue: number,
  discountType: 'absolute' | 'percent',
): number {
  return discountType === 'percent'
    ? Math.min((totalAmount * discountValue) / 100, totalAmount)
    : Math.min(discountValue, totalAmount);
}

export function computeFinalAmount(
  totalAmount: number,
  discountAmount: number,
  deliveryAmount: number,
): number {
  return Math.max(0, totalAmount - discountAmount + deliveryAmount);
}

export function assertDiscountNotExceedsGoods(totalAmount: number, discountAmount: number): void {
  if (discountAmount > totalAmount) {
    throw new ValidationError('Скидка не может быть больше стоимости товаров', undefined, {
      code: 'INVALID_DISCOUNT',
    });
  }
}

export function resolveCreatePaymentAmounts(input: {
  paymentType: SalePaymentType;
  finalAmount: number;
  cashAmount?: number | null;
  cardAmount?: number | null;
  /** Нужен только для `paymentType: 'debt'`. */
  customerName?: string | null | undefined;
}): { cashAmount: number; cardAmount: number } {
  const { paymentType, finalAmount } = input;

  if (paymentType === 'split') {
    const cash = input.cashAmount ?? 0;
    const card = input.cardAmount ?? 0;
    assertSplitPaymentTotals(cash, card, finalAmount, {
      message: 'Сумма наличных и карты должна равняться итоговой сумме',
    });
    return { cashAmount: cash, cardAmount: card };
  }
  if (paymentType === 'cash') {
    return { cashAmount: finalAmount, cardAmount: 0 };
  }
  if (paymentType === 'debt') {
    assertDebtCustomerName(input.customerName, 'create');
    return { cashAmount: 0, cardAmount: 0 };
  }
  return { cashAmount: 0, cardAmount: finalAmount };
}

export function assertDebtCustomerName(
  customerName: string | null | undefined,
  which: 'create' | 'edit',
): void {
  if (customerName?.trim()) return;
  if (which === 'create') {
    throw new ValidationError('Укажите имя клиента для продажи в долг', undefined, {
      code: 'INVALID_DEBT_CUSTOMER',
    });
  }
  throw new ValidationError('Для продажи в долг укажите имя клиента', undefined, {
    code: 'INVALID_DEBT_CUSTOMER',
  });
}

export function assertSplitPaymentTotals(
  cash: number,
  card: number,
  final: number,
  opts?: { message?: string },
): void {
  if (Math.abs(cash + card - final) <= SPLIT_PAYMENT_EPSILON) return;
  throw new ValidationError(
    opts?.message ?? 'Сумма наличных и карты должна равняться итоговой сумме',
    undefined,
    { code: 'INVALID_SPLIT' },
  );
}

/** Итог при смене только доставки: `discountValue` на сущности — уже применённая сумма скидки. */
export function finalAmountAfterDeliveryOnlyChange(
  totalAmount: number,
  storedDiscountAmount: number,
  newDeliveryAmount: number,
): number {
  return computeFinalAmount(totalAmount, storedDiscountAmount, newDeliveryAmount);
}

/**
 * Суммы оплаты, совпадающие с итогом для cash/card/debt.
 * Для split возвращает `null` — суммы на чеке не трогаем.
 */
export function cashCardForSimplePaymentType(
  paymentType: SalePaymentType,
  finalAmount: number,
): { cashAmount: number; cardAmount: number } | null {
  if (paymentType === 'cash') return { cashAmount: finalAmount, cardAmount: 0 };
  if (paymentType === 'card') return { cashAmount: 0, cardAmount: finalAmount };
  if (paymentType === 'debt') return { cashAmount: 0, cardAmount: 0 };
  return null;
}

/** Патч полей при PATCH только `deliveryAmount` (позиции не менялись). */
export function patchSalePricingForDeliveryOnly(input: {
  paymentType: SalePaymentType;
  totalAmount: number;
  storedDiscountAmount: number;
  newDeliveryAmount: number;
  currentCash: number | null;
  currentCard: number | null;
}): {
  deliveryAmount: number;
  finalAmount: number;
  cashAmount: number | null;
  cardAmount: number | null;
} {
  const finalAmount = finalAmountAfterDeliveryOnlyChange(
    input.totalAmount,
    input.storedDiscountAmount,
    input.newDeliveryAmount,
  );
  const simple = cashCardForSimplePaymentType(input.paymentType, finalAmount);
  if (simple) {
    return {
      deliveryAmount: input.newDeliveryAmount,
      finalAmount,
      cashAmount: simple.cashAmount,
      cardAmount: simple.cardAmount,
    };
  }
  return {
    deliveryAmount: input.newDeliveryAmount,
    finalAmount,
    cashAmount: input.currentCash,
    cardAmount: input.currentCard,
  };
}

const SPLIT_MSG_ON_TYPE_CHANGE = 'Сумма наличных и карты должна равняться итоговой сумме';

/** После смены `paymentType` в PATCH продажи. */
export function resolveCashCardAfterPaymentTypeChangeOnEdit(input: {
  nextPaymentType: SalePaymentType;
  finalAmount: number;
  bodyCash?: number;
  bodyCard?: number;
  saleCash: number | null;
  saleCard: number | null;
}): { cashAmount: number; cardAmount: number } {
  if (input.nextPaymentType === 'split') {
    const cash = input.bodyCash ?? input.saleCash ?? 0;
    const card = input.bodyCard ?? input.saleCard ?? 0;
    assertSplitPaymentTotals(cash, card, input.finalAmount, { message: SPLIT_MSG_ON_TYPE_CHANGE });
    return { cashAmount: cash, cardAmount: card };
  }
  if (input.nextPaymentType === 'cash') {
    return { cashAmount: input.finalAmount, cardAmount: 0 };
  }
  if (input.nextPaymentType === 'card') {
    return { cashAmount: 0, cardAmount: input.finalAmount };
  }
  return { cashAmount: 0, cardAmount: 0 };
}
