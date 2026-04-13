import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { getDataSource } from '@/lib/db/data-source';
import {
  DebtEntity,
  DebtOperationEntity,
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  type SaleItem,
} from '@/lib/db/entities';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import { logStockMovement } from '@/services/common/stock-movement.gateway';
import { sellReservationBodySchema } from '@/services/reserves/reservation-sell.validators';
import { cancelReservationSchema } from '@/services/reserves/reserves.validators';

async function releaseReservationItem(
  em: EntityManager,
  shopId: string,
  reservationId: string,
  item: SaleItem,
) {
  const stock = await em.getRepository(StockItemEntity).findOne({
    where: { shopId, flavorId: item.flavorId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!stock) return;

  const beforePost = stock.postQuantity ?? 0;
  const beforeReserved = stock.reservedQuantity ?? 0;
  stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
  stock.postQuantity = beforePost + item.quantity;
  await em.getRepository(StockItemEntity).save(stock);

  await logStockMovement(em, {
    shopId,
    productId: item.flavorId,
    productName: `${item.productNameSnapshot} ${item.flavorNameSnapshot}`.trim(),
    actionType: 'cancel_sale',
    fromZone: 'warehouse',
    toZone: 'post',
    quantity: item.quantity,
    postStockBefore: beforePost,
    postStockAfter: stock.postQuantity,
    warehouseBefore: stock.quantity,
    warehouseAfter: stock.quantity,
    contextType: 'reservation',
    contextId: reservationId,
    comment: `Возврат резерва #${reservationId.slice(0, 8)}: ${beforeReserved} -> ${stock.reservedQuantity ?? 0}`,
  });
}

async function expireReservationsInTransaction(em: EntityManager, shopId: string, now: Date) {
  const allReservations = await em.getRepository(SaleEntity).find({
    where: {
      shopId,
      isReservation: true,
      status: 'active',
    },
  });
  const expired = allReservations.filter(
    (r) => r.reservationExpiry && new Date(r.reservationExpiry) <= now,
  );
  if (expired.length === 0) return 0;

  const expiredIds = expired.map((r) => r.id);
  const items = await em.getRepository(SaleItemEntity).find({
    where: { saleId: In(expiredIds) },
  });
  const itemsByReservationId = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByReservationId.get(it.saleId) ?? [];
    list.push(it);
    itemsByReservationId.set(it.saleId, list);
  }

  for (const r of expired) {
    const reservationItems = itemsByReservationId.get(r.id) ?? [];
    for (const item of reservationItems) {
      await releaseReservationItem(em, shopId, r.id, item);
    }
    r.status = 'deleted';
    await em.getRepository(SaleEntity).save(r);
  }
  return expired.length;
}

export async function listActiveReservations(context: ShopContext) {
  const now = new Date();
  await withTransaction(async (em) => {
    await expireReservationsInTransaction(em, context.shopId, now);
  });

  const ds = await getDataSource();

  const reservations = await ds.getRepository(SaleEntity).find({
    where: {
      shopId: context.shopId,
      isReservation: true,
      status: 'active',
    },
    order: { reservationExpiry: 'ASC' },
  });

  const activeReservations = reservations.filter(
    (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > now,
  );

  const reservationIds = activeReservations.map((r) => r.id);
  const items =
    reservationIds.length > 0
      ? await ds.getRepository(SaleItemEntity).find({
          where: { saleId: In(reservationIds) },
        })
      : [];

  const itemsByReservationId = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByReservationId.get(item.saleId) ?? [];
    list.push(item);
    itemsByReservationId.set(item.saleId, list);
  }

  return activeReservations.map((r) => ({
    ...r,
    items: itemsByReservationId.get(r.id) ?? [],
  }));
}

export async function cancelReservation(context: ShopContext, body: unknown) {
  const parsed = cancelReservationSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const reservation = await em.getRepository(SaleEntity).findOne({
      where: {
        id: parsed.data.reservationId,
        shopId: context.shopId,
        isReservation: true,
        status: 'active',
      },
    });

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    const items = await em.getRepository(SaleItemEntity).find({
      where: { saleId: reservation.id },
    });

    for (const item of items) {
      await releaseReservationItem(em, context.shopId, reservation.id, item);
    }

    reservation.status = 'deleted';
    await em.getRepository(SaleEntity).save(reservation);

    return { success: true as const };
  });
}

export async function expireStaleReservationsNow(context: ShopContext) {
  const now = new Date();
  const count = await withTransaction(async (em) =>
    expireReservationsInTransaction(em, context.shopId, now),
  );
  return { returned: count };
}

export async function sellReservation(context: ShopContext, reservationId: string, body: unknown) {
  const parsedBody = sellReservationBodySchema.safeParse(body);
  if (!parsedBody.success) {
    throw new ValidationError('Invalid body', parsedBody.error.flatten(), { code: 'INVALID_BODY' });
  }

  const paymentType = parsedBody.data.paymentType ?? 'cash';

  return withTransaction(async (em) => {
    const reservation = await em.getRepository(SaleEntity).findOne({
      where: {
        id: reservationId,
        shopId: context.shopId,
        isReservation: true,
        status: 'active',
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    const lockedFinalAmount = reservation.finalAmount;

    const debtCustomerCandidate =
      paymentType === 'debt'
        ? reservation.reservationCustomerName?.trim() || parsedBody.data.customerName?.trim() || null
        : null;

    if (paymentType === 'split') {
      const cash = parsedBody.data.cashAmount ?? 0;
      const card = parsedBody.data.cardAmount ?? 0;
      if (Math.abs(cash + card - lockedFinalAmount) > 0.01) {
        throw new ValidationError('Сумма наличных и карты должна равняться итоговой сумме', undefined, {
          code: 'SPLIT_MISMATCH',
        });
      }
    } else if (paymentType === 'debt' && !debtCustomerCandidate) {
      throw new ValidationError(
        'Для продажи в долг укажите клиента в резерве или в форме продажи',
        undefined,
        { code: 'DEBT_CUSTOMER_REQUIRED' },
      );
    }

    const items = await em.getRepository(SaleItemEntity).find({
      where: { saleId: reservation.id },
    });

    for (const item of items) {
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: context.shopId, flavorId: item.flavorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (stock) {
        const beforeQty = stock.quantity;
        const beforePostQty = stock.postQuantity ?? 0;
        stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
        stock.quantity = Math.max(0, stock.quantity - item.quantity);
        await logStockMovement(em, {
          shopId: context.shopId,
          productId: item.flavorId,
          productName: `${item.productNameSnapshot} ${item.flavorNameSnapshot}`.trim(),
          actionType: 'reservation_sale',
          fromZone: 'warehouse',
          toZone: null,
          quantity: item.quantity,
          postStockBefore: beforePostQty,
          postStockAfter: beforePostQty,
          warehouseBefore: beforeQty,
          warehouseAfter: stock.quantity,
          contextType: 'reservation',
          contextId: reservation.id,
          comment: `Продажа резерва #${reservation.id.slice(0, 8)}`,
        });
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    reservation.isReservation = false;
    reservation.paymentType = paymentType;
    reservation.status = 'active';

    if (paymentType === 'cash') {
      reservation.cashAmount = lockedFinalAmount;
      reservation.cardAmount = 0;
    } else if (paymentType === 'card') {
      reservation.cashAmount = 0;
      reservation.cardAmount = lockedFinalAmount;
    } else if (paymentType === 'split') {
      reservation.cashAmount = parsedBody.data.cashAmount ?? 0;
      reservation.cardAmount = parsedBody.data.cardAmount ?? 0;
    } else if (paymentType === 'debt') {
      if (!debtCustomerCandidate) {
        throw new ValidationError(
          'Для продажи в долг укажите клиента в резерве или в форме продажи',
          undefined,
          { code: 'DEBT_CUSTOMER_REQUIRED' },
        );
      }
      const debtCustomerName = debtCustomerCandidate;
      reservation.cashAmount = 0;
      reservation.cardAmount = 0;
      reservation.customerName = debtCustomerName;
      let debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: context.shopId, customerName: debtCustomerName },
      });
      if (!debt) {
        debt = em.getRepository(DebtEntity).create({
          shopId: context.shopId,
          customerName: debtCustomerName,
          totalDebt: 0,
        });
        await em.getRepository(DebtEntity).save(debt);
      }
      debt.totalDebt += lockedFinalAmount;
      await em.getRepository(DebtEntity).save(debt);
      const op = em.getRepository(DebtOperationEntity).create({
        debtId: debt.id,
        saleId: reservation.id,
        amount: lockedFinalAmount,
        datetime: new Date(),
        comment: `Продажа резерва #${reservation.id.slice(0, 8)}`,
      });
      await em.getRepository(DebtOperationEntity).save(op);
    }
    await em.getRepository(SaleEntity).save(reservation);

    return { message: 'Reservation sold successfully', sale: reservation };
  });
}
