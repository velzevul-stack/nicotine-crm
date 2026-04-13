import type { EntityManager } from 'typeorm';
import { getDataSource } from '@/lib/db/data-source';
import { withTransaction } from '@/services/common/transaction';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  type Sale,
  type SaleItem,
  FlavorEntity,
  DebtEntity,
  DebtOperationEntity,
} from '@/lib/db/entities';
import { logStockMovement } from '@/services/common/stock-movement.gateway';
import { buildConsumableFlavorIdSet } from '@/lib/consumable-category';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ServiceContext } from '@/services/common/service-context';
import { sumDebtOperationAmountsByDebtId } from '@/services/sales/debt.policy';
import { parseApiFlexibleDatetime } from '@/services/sales/sale-datetime.policy';
import {
  assertDebtCustomerName,
  assertDiscountNotExceedsGoods,
  assertSplitPaymentTotals,
  computeDiscountAmount,
  computeFinalAmount,
  patchSalePricingForDeliveryOnly,
  resolveCashCardAfterPaymentTypeChangeOnEdit,
  resolveCreatePaymentAmounts,
  sumLineTotals,
} from '@/services/sales/pricing.policy';
import { assertReservationRulesForCreate } from '@/services/sales/reservation.policy';
import {
  assertLineStockAvailable,
  quantitiesAfterApplyReservationLine,
  quantitiesAfterApplyWarehouseSaleLine,
  quantitiesAfterDeleteUndoReservationLine,
  quantitiesAfterDeleteUndoWarehouseSaleLine,
  quantitiesAfterEditUndoReservationLine,
  quantitiesAfterEditUndoWarehouseSaleLine,
} from '@/services/sales/stock-allocation.policy';
import {
  findSaleByIdForShop,
  findSaleItemsBySaleIds,
  findSaleItemsForSaleId,
  querySalesListForShop,
} from '@/services/sales/sales.repository';
import { createSaleSchema, updateSaleSchema } from '@/services/sales/sales.validators';

export { createSaleSchema, updateSaleSchema };

export async function createSale(context: ServiceContext, input: unknown) {
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const {
    paymentType,
    cashAmount: reqCashAmount,
    cardAmount: reqCardAmount,
    cardId,
    discountValue,
    discountType,
    comment,
    customerName,
    isReservation,
    reservationExpiry,
    reservationCustomerName,
    saleDate,
    deliveryAmount,
    items,
  } = parsed.data;

  const totalAmount = sumLineTotals(items);
  const discountAmount = computeDiscountAmount(totalAmount, discountValue, discountType);
  const finalAmount = computeFinalAmount(totalAmount, discountAmount, deliveryAmount);

  const { cashAmount, cardAmount } = resolveCreatePaymentAmounts({
    paymentType,
    finalAmount,
    cashAmount: reqCashAmount,
    cardAmount: reqCardAmount,
    customerName,
  });

  assertDiscountNotExceedsGoods(totalAmount, discountAmount);
  assertReservationRulesForCreate(isReservation, reservationExpiry);

  return withTransaction(async (em) => {
    const consumableFlavorIds = await buildConsumableFlavorIdSet(
      em,
      context.shopId,
      items.map((i) => i.flavorId),
    );

    for (const it of items) {
      const flavor = await em.getRepository(FlavorEntity).findOne({
        where: { id: it.flavorId, shopId: context.shopId },
      });
      if (!flavor) {
        throw new ValidationError(
          `Товар не найден или не принадлежит вашему магазину: ${it.flavorNameSnapshot}`,
          undefined,
          { code: 'FLAVOR_NOT_FOUND' },
        );
      }
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: context.shopId, flavorId: it.flavorId },
        lock: { mode: 'pessimistic_write' },
      });
      assertLineStockAvailable({
        flavorNameSnapshot: it.flavorNameSnapshot,
        quantity: it.quantity,
        isConsumable: consumableFlavorIds.has(it.flavorId),
        stock,
        isReservation,
        wording: 'create',
      });
    }

    const now = new Date();
    const saleDateTime = saleDate ? new Date(saleDate) : now;
    const sale = em.getRepository(SaleEntity).create({
      shopId: context.shopId,
      sellerId: context.userId,
      datetime: now,
      saleDate: saleDateTime,
      paymentType,
      totalAmount,
      totalCost: null,
      discountValue: discountAmount,
      discountType,
      deliveryAmount,
      finalAmount,
      cashAmount,
      cardAmount,
      cardId: cardId ?? null,
      comment,
      customerName: customerName?.trim() || null,
      isReservation: isReservation ?? false,
      reservationExpiry: reservationExpiry ? new Date(reservationExpiry) : null,
      reservationCustomerName:
        isReservation && reservationCustomerName ? reservationCustomerName.trim() : null,
      status: 'active',
    });
    await em.getRepository(SaleEntity).save(sale);

    for (const it of items) {
      let stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: context.shopId, flavorId: it.flavorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!stock) {
        stock = em.getRepository(StockItemEntity).create({
          shopId: context.shopId,
          flavorId: it.flavorId,
          quantity: 0,
          costPrice: 0,
        });
        await em.getRepository(StockItemEntity).save(stock);
      }

      const si = em.getRepository(SaleItemEntity).create({
        saleId: sale.id,
        flavorId: it.flavorId,
        productNameSnapshot: it.productNameSnapshot,
        flavorNameSnapshot: it.flavorNameSnapshot,
        unitPrice: it.unitPrice,
        costPriceSnapshot: stock.costPrice ?? 0,
        quantity: it.quantity,
        lineTotal: it.lineTotal,
      });
      await em.getRepository(SaleItemEntity).save(si);

      if (isReservation) {
        const beforePostQty = stock.postQuantity ?? 0;
        const rq = quantitiesAfterApplyReservationLine(
          beforePostQty,
          stock.reservedQuantity ?? 0,
          it.quantity,
        );
        stock.reservedQuantity = rq.reservedQuantity;
        stock.postQuantity = rq.postQuantity;
        await logStockMovement(em, {
          shopId: context.shopId,
          productId: it.flavorId,
          productName: `${it.productNameSnapshot} ${it.flavorNameSnapshot}`.trim(),
          actionType: 'manual_transfer',
          fromZone: 'post',
          toZone: 'warehouse',
          quantity: it.quantity,
          postStockBefore: beforePostQty,
          postStockAfter: stock.postQuantity,
          warehouseBefore: stock.quantity,
          warehouseAfter: stock.quantity,
          contextType: 'reservation',
          contextId: sale.id,
          comment: `Резерв #${sale.id.slice(0, 8)}`,
        });
      } else {
        const beforeQty = stock.quantity;
        const beforePostQty = stock.postQuantity ?? 0;
        const isConsumable = consumableFlavorIds.has(it.flavorId);
        const wq = quantitiesAfterApplyWarehouseSaleLine(
          stock.quantity,
          beforePostQty,
          it.quantity,
          isConsumable,
        );
        stock.quantity = wq.quantity;
        stock.postQuantity = wq.postQuantity;
        await logStockMovement(em, {
          shopId: context.shopId,
          productId: it.flavorId,
          productName: `${it.productNameSnapshot} ${it.flavorNameSnapshot}`.trim(),
          actionType: paymentType === 'debt' ? 'debt_sale' : 'sale',
          fromZone: 'warehouse',
          toZone: null,
          quantity: it.quantity,
          postStockBefore: beforePostQty,
          postStockAfter: stock.postQuantity,
          warehouseBefore: beforeQty,
          warehouseAfter: stock.quantity,
          contextType: paymentType === 'debt' ? 'debt' : 'sale',
          contextId: sale.id,
          comment: paymentType === 'debt' ? `Долг #${sale.id.slice(0, 8)}` : `Чек #${sale.id.slice(0, 8)}`,
        });
      }
      await em.getRepository(StockItemEntity).save(stock);
    }

    if (paymentType === 'debt' && customerName?.trim()) {
      const custName = customerName.trim();
      let debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: context.shopId, customerName: custName },
      });
      if (!debt) {
        debt = em.getRepository(DebtEntity).create({
          shopId: context.shopId,
          customerName: custName,
          totalDebt: 0,
        });
        await em.getRepository(DebtEntity).save(debt);
      }
      debt.totalDebt += finalAmount;
      await em.getRepository(DebtEntity).save(debt);
      const op = em.getRepository(DebtOperationEntity).create({
        debtId: debt.id,
        saleId: sale.id,
        amount: finalAmount,
        datetime: now,
        comment: `Продажа #${sale.id.slice(0, 8)}`,
      });
      await em.getRepository(DebtOperationEntity).save(op);
    }

    return { id: sale.id, finalAmount, datetime: sale.datetime };
  });
}

export async function listSales(context: ServiceContext, from?: string | null, to?: string | null) {
  const ds = await getDataSource();
  const salesList = await querySalesListForShop(ds, context.shopId, from, to);
  const saleIds = salesList.map((s) => s.id);
  const items = await findSaleItemsBySaleIds(ds, saleIds);
  const itemsBySaleId = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsBySaleId.get(it.saleId) ?? [];
    list.push(it);
    itemsBySaleId.set(it.saleId, list);
  }
  return salesList.map((s) => ({ ...s, items: itemsBySaleId.get(s.id) ?? [] }));
}

export async function getSaleById(context: ServiceContext, id: string) {
  const ds = await getDataSource();
  const sale = await findSaleByIdForShop(ds, context.shopId, id);
  if (!sale) throw new NotFoundError('Sale not found');
  const items = await findSaleItemsForSaleId(ds, sale.id);
  return { ...sale, items };
}

async function restoreOldItemsForUpdate(
  em: EntityManager,
  context: ServiceContext,
  sale: Sale,
  oldItems: SaleItem[],
  effectivePaymentType: 'cash' | 'card' | 'split' | 'debt',
) {
  for (const oldItem of oldItems) {
    const stock = await em.getRepository(StockItemEntity).findOne({
      where: { shopId: context.shopId, flavorId: oldItem.flavorId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!stock) continue;
    if (sale.isReservation) {
      const beforePostQty = stock.postQuantity ?? 0;
      const beforeReserved = stock.reservedQuantity ?? 0;
      const uq = quantitiesAfterEditUndoReservationLine(
        beforePostQty,
        stock.reservedQuantity ?? 0,
        oldItem.quantity,
      );
      stock.reservedQuantity = uq.reservedQuantity;
      stock.postQuantity = uq.postQuantity;
      await logStockMovement(em, {
        shopId: context.shopId,
        productId: oldItem.flavorId,
        productName: `${oldItem.productNameSnapshot} ${oldItem.flavorNameSnapshot}`.trim(),
        actionType: 'cancel_sale',
        fromZone: 'warehouse',
        toZone: 'post',
        quantity: oldItem.quantity,
        postStockBefore: beforePostQty,
        postStockAfter: stock.postQuantity,
        warehouseBefore: stock.quantity,
        warehouseAfter: stock.quantity,
        contextType: 'reservation',
        contextId: sale.id,
        comment: `Снятие резерва (редактирование) #${sale.id.slice(0, 8)}: ${beforeReserved} -> ${stock.reservedQuantity ?? 0}`,
      });
    } else {
      const beforeQty = stock.quantity;
      const beforePostQty = stock.postQuantity ?? 0;
      const uq = quantitiesAfterEditUndoWarehouseSaleLine(
        stock.quantity,
        beforePostQty,
        oldItem.quantity,
      );
      stock.quantity = uq.quantity;
      stock.postQuantity = uq.postQuantity;
      await logStockMovement(em, {
        shopId: context.shopId,
        productId: oldItem.flavorId,
        productName: `${oldItem.productNameSnapshot} ${oldItem.flavorNameSnapshot}`.trim(),
        actionType: 'cancel_sale',
        fromZone: null,
        toZone: 'warehouse',
        quantity: oldItem.quantity,
        postStockBefore: beforePostQty,
        postStockAfter: stock.postQuantity,
        warehouseBefore: beforeQty,
        warehouseAfter: stock.quantity,
        contextType: effectivePaymentType === 'debt' ? 'debt' : 'sale',
        contextId: sale.id,
        comment: `Отмена (редактирование) чека #${sale.id.slice(0, 8)}`,
      });
    }
    await em.getRepository(StockItemEntity).save(stock);
  }
}

export async function updateSale(context: ServiceContext, id: string, input: unknown) {
  const parsed = updateSaleSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }
  return withTransaction(async (em) => {
    const sale = await em.getRepository(SaleEntity).findOne({ where: { id, shopId: context.shopId } });
    if (!sale) throw new NotFoundError('Sale not found');
    if (sale.status === 'deleted') {
      throw new ValidationError('Cannot edit deleted sale', undefined, { code: 'SALE_DELETED' });
    }

    const oldItems = await em.getRepository(SaleItemEntity).find({ where: { saleId: sale.id } });
    const effectivePaymentType = parsed.data.paymentType ?? sale.paymentType;
    const effectiveIsReservation = parsed.data.isReservation ?? sale.isReservation;

    if (parsed.data.items !== undefined) {
      const consumableFlavorIds = await buildConsumableFlavorIdSet(
        em,
        context.shopId,
        [...new Set([...oldItems.map((o) => o.flavorId), ...parsed.data.items.map((i) => i.flavorId)])],
      );
      await restoreOldItemsForUpdate(em, context, sale, oldItems, effectivePaymentType);
      await em.getRepository(SaleItemEntity).delete({ saleId: sale.id });

      for (const it of parsed.data.items) {
        const flavor = await em.getRepository(FlavorEntity).findOne({
          where: { id: it.flavorId, shopId: context.shopId },
        });
        if (!flavor) {
          throw new ValidationError(
            `Товар не найден или не принадлежит вашему магазину: ${it.flavorNameSnapshot}`,
            undefined,
            { code: 'FLAVOR_NOT_FOUND' },
          );
        }
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: context.shopId, flavorId: it.flavorId },
          lock: { mode: 'pessimistic_write' },
        });
        assertLineStockAvailable({
          flavorNameSnapshot: it.flavorNameSnapshot,
          quantity: it.quantity,
          isConsumable: consumableFlavorIds.has(it.flavorId),
          stock,
          isReservation: effectiveIsReservation,
          wording: 'update',
        });
      }

      const totalAmount = sumLineTotals(parsed.data.items);
      const discountValue = parsed.data.discountValue ?? sale.discountValue;
      const discountType = parsed.data.discountType ?? sale.discountType;
      const discountAmount = computeDiscountAmount(totalAmount, discountValue, discountType);
      const deliveryAmt =
        parsed.data.deliveryAmount !== undefined ? parsed.data.deliveryAmount : (sale.deliveryAmount ?? 0);
      const finalAmount = computeFinalAmount(totalAmount, discountAmount, deliveryAmt);

      sale.totalAmount = totalAmount;
      sale.discountValue = discountAmount;
      sale.discountType = discountType;
      sale.deliveryAmount = deliveryAmt;
      sale.finalAmount = finalAmount;

      for (const it of parsed.data.items) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: context.shopId, flavorId: it.flavorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!stock) {
          throw new ValidationError(`Stock not found for flavor ${it.flavorId}`, undefined, {
            code: 'STOCK_NOT_FOUND',
          });
        }

        const si = em.getRepository(SaleItemEntity).create({
          saleId: sale.id,
          flavorId: it.flavorId,
          productNameSnapshot: it.productNameSnapshot,
          flavorNameSnapshot: it.flavorNameSnapshot,
          unitPrice: it.unitPrice,
          costPriceSnapshot: stock.costPrice ?? 0,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
        });
        await em.getRepository(SaleItemEntity).save(si);

        if (effectiveIsReservation) {
          const beforePostQty = stock.postQuantity ?? 0;
          const rq = quantitiesAfterApplyReservationLine(
            beforePostQty,
            stock.reservedQuantity ?? 0,
            it.quantity,
          );
          stock.reservedQuantity = rq.reservedQuantity;
          stock.postQuantity = rq.postQuantity;
          await logStockMovement(em, {
            shopId: context.shopId,
            productId: it.flavorId,
            productName: `${it.productNameSnapshot} ${it.flavorNameSnapshot}`.trim(),
            actionType: 'manual_transfer',
            fromZone: 'post',
            toZone: 'warehouse',
            quantity: it.quantity,
            postStockBefore: beforePostQty,
            postStockAfter: stock.postQuantity,
            warehouseBefore: stock.quantity,
            warehouseAfter: stock.quantity,
            contextType: 'reservation',
            contextId: sale.id,
            comment: `Резерв (редактирование) #${sale.id.slice(0, 8)}`,
          });
        } else {
          const beforeQty = stock.quantity;
          const beforePostQty = stock.postQuantity ?? 0;
          const isConLine = consumableFlavorIds.has(it.flavorId);
          const wq = quantitiesAfterApplyWarehouseSaleLine(
            stock.quantity,
            beforePostQty,
            it.quantity,
            isConLine,
          );
          stock.quantity = wq.quantity;
          stock.postQuantity = wq.postQuantity;
          await logStockMovement(em, {
            shopId: context.shopId,
            productId: it.flavorId,
            productName: `${it.productNameSnapshot} ${it.flavorNameSnapshot}`.trim(),
            actionType: effectivePaymentType === 'debt' ? 'debt_sale' : 'sale',
            fromZone: 'warehouse',
            toZone: null,
            quantity: it.quantity,
            postStockBefore: beforePostQty,
            postStockAfter: stock.postQuantity,
            warehouseBefore: beforeQty,
            warehouseAfter: stock.quantity,
            contextType: effectivePaymentType === 'debt' ? 'debt' : 'sale',
            contextId: sale.id,
            comment: `Редактирование чека #${sale.id.slice(0, 8)}`,
          });
        }
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    if (parsed.data.items === undefined && parsed.data.deliveryAmount !== undefined) {
      const p = patchSalePricingForDeliveryOnly({
        paymentType: sale.paymentType,
        totalAmount: sale.totalAmount,
        storedDiscountAmount: sale.discountValue,
        newDeliveryAmount: parsed.data.deliveryAmount,
        currentCash: sale.cashAmount,
        currentCard: sale.cardAmount,
      });
      sale.deliveryAmount = p.deliveryAmount;
      sale.finalAmount = p.finalAmount;
      sale.cashAmount = p.cashAmount;
      sale.cardAmount = p.cardAmount;
    }

    const final = sale.finalAmount;
    if (parsed.data.paymentType !== undefined) {
      sale.paymentType = parsed.data.paymentType;
      const amounts = resolveCashCardAfterPaymentTypeChangeOnEdit({
        nextPaymentType: parsed.data.paymentType,
        finalAmount: final,
        bodyCash: parsed.data.cashAmount,
        bodyCard: parsed.data.cardAmount,
        saleCash: sale.cashAmount,
        saleCard: sale.cardAmount,
      });
      sale.cashAmount = amounts.cashAmount;
      sale.cardAmount = amounts.cardAmount;
    }
    if (sale.paymentType === 'split') {
      if (parsed.data.cashAmount !== undefined) sale.cashAmount = parsed.data.cashAmount;
      if (parsed.data.cardAmount !== undefined) sale.cardAmount = parsed.data.cardAmount;
      assertSplitPaymentTotals(sale.cashAmount ?? 0, sale.cardAmount ?? 0, final, {
        message: 'Для split-оплаты сумма наличных и карты должна совпадать с итогом',
      });
    }
    if (parsed.data.cardId !== undefined) sale.cardId = parsed.data.cardId;
    if (parsed.data.comment !== undefined) sale.comment = parsed.data.comment;
    if (parsed.data.customerName !== undefined) sale.customerName = parsed.data.customerName?.trim() || null;
    if (parsed.data.saleDate !== undefined && parsed.data.saleDate) {
      const next = parseApiFlexibleDatetime(parsed.data.saleDate);
      sale.saleDate = next;
      sale.datetime = next;
    }
    if (parsed.data.isReservation !== undefined) sale.isReservation = parsed.data.isReservation;
    if (sale.paymentType === 'debt') {
      assertDebtCustomerName(sale.customerName, 'edit');
      sale.cashAmount = 0;
      sale.cardAmount = 0;
    }
    if (parsed.data.reservationExpiry !== undefined) {
      if (parsed.data.reservationExpiry) {
        sale.reservationExpiry = parseApiFlexibleDatetime(parsed.data.reservationExpiry);
      } else {
        sale.reservationExpiry = null;
      }
    }

    sale.status = 'edited';
    await em.getRepository(SaleEntity).save(sale);

    const existingOps = await em.getRepository(DebtOperationEntity).find({ where: { saleId: sale.id } });
    if (existingOps.length > 0) {
      const byDebtId = sumDebtOperationAmountsByDebtId(existingOps);
      for (const [debtId, amount] of byDebtId.entries()) {
        const debt = await em.getRepository(DebtEntity).findOne({ where: { id: debtId, shopId: context.shopId } });
        if (debt) {
          debt.totalDebt = Math.max(0, debt.totalDebt - amount);
          await em.getRepository(DebtEntity).save(debt);
        }
      }
      await em.getRepository(DebtOperationEntity).delete({ saleId: sale.id });
    }

    if (sale.paymentType === 'debt' && sale.customerName?.trim()) {
      const debtCustomer = sale.customerName.trim();
      let debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: context.shopId, customerName: debtCustomer },
      });
      if (!debt) {
        debt = em.getRepository(DebtEntity).create({
          shopId: context.shopId,
          customerName: debtCustomer,
          totalDebt: 0,
        });
        await em.getRepository(DebtEntity).save(debt);
      }
      debt.totalDebt += sale.finalAmount;
      await em.getRepository(DebtEntity).save(debt);
      const debtOp = em.getRepository(DebtOperationEntity).create({
        debtId: debt.id,
        saleId: sale.id,
        amount: sale.finalAmount,
        datetime: new Date(),
        comment: `Редактирование продажи #${sale.id.slice(0, 8)}`,
      });
      await em.getRepository(DebtOperationEntity).save(debtOp);
    }

    const updatedItems = await em.getRepository(SaleItemEntity).find({ where: { saleId: sale.id } });
    return { ...sale, items: updatedItems };
  });
}

export async function deleteSale(context: ServiceContext, id: string) {
  return withTransaction(async (em) => {
    const sale = await em.getRepository(SaleEntity).findOne({ where: { id, shopId: context.shopId } });
    if (!sale) throw new NotFoundError('Sale not found');
    if (sale.status === 'deleted') {
      throw new ValidationError('Sale already deleted', undefined, { code: 'ALREADY_DELETED' });
    }

    const items = await em.getRepository(SaleItemEntity).find({ where: { saleId: sale.id } });
    const consumableFlavorIds = await buildConsumableFlavorIdSet(
      em,
      context.shopId,
      items.map((i) => i.flavorId),
    );

    for (const item of items) {
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: context.shopId, flavorId: item.flavorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!stock) continue;
      if (sale.isReservation) {
        const beforePostQty = stock.postQuantity ?? 0;
        const beforeReserved = stock.reservedQuantity ?? 0;
        const dq = quantitiesAfterDeleteUndoReservationLine(
          beforePostQty,
          stock.reservedQuantity ?? 0,
          item.quantity,
          consumableFlavorIds.has(item.flavorId),
        );
        stock.reservedQuantity = dq.reservedQuantity;
        stock.postQuantity = dq.postQuantity;
        await logStockMovement(em, {
          shopId: context.shopId,
          productId: item.flavorId,
          productName: `${item.productNameSnapshot} ${item.flavorNameSnapshot}`.trim(),
          actionType: 'cancel_sale',
          fromZone: 'warehouse',
          toZone: 'post',
          quantity: item.quantity,
          postStockBefore: beforePostQty,
          postStockAfter: stock.postQuantity,
          warehouseBefore: stock.quantity,
          warehouseAfter: stock.quantity,
          contextType: 'reservation',
          contextId: sale.id,
          comment: `Отмена резерва #${sale.id.slice(0, 8)}: ${beforeReserved} -> ${stock.reservedQuantity ?? 0}`,
        });
      } else {
        const beforeQty = stock.quantity;
        const beforePostQty = stock.postQuantity ?? 0;
        const dq = quantitiesAfterDeleteUndoWarehouseSaleLine(
          stock.quantity,
          beforePostQty,
          item.quantity,
          consumableFlavorIds.has(item.flavorId),
        );
        stock.quantity = dq.quantity;
        stock.postQuantity = dq.postQuantity;
        await logStockMovement(em, {
          shopId: context.shopId,
          productId: item.flavorId,
          productName: `${item.productNameSnapshot} ${item.flavorNameSnapshot}`.trim(),
          actionType: 'cancel_sale',
          fromZone: null,
          toZone: 'warehouse',
          quantity: item.quantity,
          postStockBefore: beforePostQty,
          postStockAfter: stock.postQuantity,
          warehouseBefore: beforeQty,
          warehouseAfter: stock.quantity,
          contextType: sale.paymentType === 'debt' ? 'debt' : 'sale',
          contextId: sale.id,
          comment: `Отмена чека #${sale.id.slice(0, 8)}`,
        });
      }
      await em.getRepository(StockItemEntity).save(stock);
    }

    if (sale.paymentType === 'debt' && sale.customerName) {
      const debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: context.shopId, customerName: sale.customerName.trim() },
      });
      if (debt) {
        debt.totalDebt = Math.max(0, debt.totalDebt - sale.finalAmount);
        await em.getRepository(DebtEntity).save(debt);
      }
      await em.getRepository(DebtOperationEntity).delete({ saleId: sale.id });
    }

    sale.status = 'deleted';
    await em.getRepository(SaleEntity).save(sale);
    return { message: 'Sale deleted successfully' };
  });
}
