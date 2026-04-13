import { describe, expect, it } from 'vitest';
import { InsufficientStockError } from '@/services/common/domain-errors';
import {
  assertLineStockAvailable,
  getAvailableForSaleLine,
  getPostAvailable,
  getWarehouseAvailable,
  quantitiesAfterApplyReservationLine,
  quantitiesAfterApplyWarehouseSaleLine,
  quantitiesAfterDeleteUndoReservationLine,
  quantitiesAfterDeleteUndoWarehouseSaleLine,
  quantitiesAfterEditUndoReservationLine,
  quantitiesAfterEditUndoWarehouseSaleLine,
} from '@/services/sales/stock-allocation.policy';

const stock = (q: Partial<{ quantity: number; postQuantity: number; reservedQuantity: number }>) =>
  ({
    quantity: q.quantity ?? 0,
    postQuantity: q.postQuantity ?? 0,
    reservedQuantity: q.reservedQuantity ?? 0,
  }) as import('@/lib/db/entities').StockItem;

describe('getWarehouseAvailable', () => {
  it('subtracts reserved from quantity', () => {
    expect(getWarehouseAvailable(stock({ quantity: 10, reservedQuantity: 3 }))).toBe(7);
  });
  it('treats null as empty', () => {
    expect(getWarehouseAvailable(null)).toBe(0);
  });
});

describe('getPostAvailable', () => {
  it('returns post quantity', () => {
    expect(getPostAvailable(stock({ postQuantity: 4 }))).toBe(4);
  });
});

describe('getAvailableForSaleLine', () => {
  it('uses warehouse only for consumable', () => {
    expect(getAvailableForSaleLine(true, stock({ quantity: 5, reservedQuantity: 0 }))).toBe(5);
  });
  it('uses min warehouse/post for non-consumable when post positive', () => {
    expect(getAvailableForSaleLine(false, stock({ quantity: 10, postQuantity: 3, reservedQuantity: 0 }))).toBe(3);
  });
});

describe('assertLineStockAvailable', () => {
  it('throws when not enough', () => {
    expect(() =>
      assertLineStockAvailable({
        flavorNameSnapshot: 'X',
        quantity: 100,
        isConsumable: true,
        stock: stock({ quantity: 5, reservedQuantity: 0 }),
        isReservation: false,
        wording: 'create',
      }),
    ).toThrow(InsufficientStockError);
  });
  it('passes when enough', () => {
    expect(() =>
      assertLineStockAvailable({
        flavorNameSnapshot: 'X',
        quantity: 2,
        isConsumable: true,
        stock: stock({ quantity: 5, reservedQuantity: 0 }),
        isReservation: false,
        wording: 'update',
      }),
    ).not.toThrow();
  });
});

describe('quantity transitions', () => {
  it('quantitiesAfterApplyReservationLine', () => {
    expect(quantitiesAfterApplyReservationLine(5, 1, 2)).toEqual({
      reservedQuantity: 3,
      postQuantity: 3,
    });
  });
  it('quantitiesAfterApplyWarehouseSaleLine respects consumable', () => {
    expect(quantitiesAfterApplyWarehouseSaleLine(10, 4, 2, true)).toEqual({
      quantity: 8,
      postQuantity: 4,
    });
    expect(quantitiesAfterApplyWarehouseSaleLine(10, 4, 2, false)).toEqual({
      quantity: 8,
      postQuantity: 2,
    });
  });
  it('quantitiesAfterEditUndoReservationLine', () => {
    expect(quantitiesAfterEditUndoReservationLine(1, 5, 2)).toEqual({
      reservedQuantity: 3,
      postQuantity: 3,
    });
  });
  it('quantitiesAfterDeleteUndoReservationLine consumable', () => {
    expect(quantitiesAfterDeleteUndoReservationLine(2, 5, 2, true)).toEqual({
      reservedQuantity: 3,
      postQuantity: 2,
    });
  });
  it('quantitiesAfterDeleteUndoReservationLine non-consumable', () => {
    expect(quantitiesAfterDeleteUndoReservationLine(2, 5, 2, false)).toEqual({
      reservedQuantity: 3,
      postQuantity: 4,
    });
  });
  it('quantitiesAfterEditUndoWarehouseSaleLine', () => {
    expect(quantitiesAfterEditUndoWarehouseSaleLine(8, 2, 2)).toEqual({
      quantity: 10,
      postQuantity: 4,
    });
  });
  it('quantitiesAfterDeleteUndoWarehouseSaleLine', () => {
    expect(quantitiesAfterDeleteUndoWarehouseSaleLine(5, 1, 2, false)).toEqual({
      quantity: 7,
      postQuantity: 3,
    });
  });
});
