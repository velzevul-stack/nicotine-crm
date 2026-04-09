import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  DebtEntity,
  DebtOperationEntity,
} from '@/lib/db/entities';
import { logStockMovement } from '@/lib/stock-movement-log';

const sellBodySchema = z
  .object({
    paymentType: z.enum(['cash', 'card', 'split', 'debt']).optional(),
    cashAmount: z.number().optional(),
    cardAmount: z.number().optional(),
    customerName: z.string().nullable().optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parsedBody = sellBodySchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const paymentType = parsedBody.data.paymentType ?? 'cash';

  const ds = await getDataSource();

  try {
    return await ds.transaction(async (em) => {
      const reservation = await em.getRepository(SaleEntity).findOne({
        where: { id, shopId: session.shopId, isReservation: true, status: 'active' },
        lock: { mode: 'pessimistic_write' },
      });

      if (!reservation) {
        return NextResponse.json({ message: 'Reservation not found' }, { status: 404 });
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
          throw new Error('SPLIT_MISMATCH');
        }
      } else if (paymentType === 'debt' && !debtCustomerCandidate) {
        throw new Error('DEBT_CUSTOMER_REQUIRED');
      }

      const items = await em.getRepository(SaleItemEntity).find({
        where: { saleId: reservation.id },
      });

      // Convert reservation to sale: reserved leaves warehouse physically, postQuantity stays unchanged
      // because item was already hidden from showcase at reservation time.
      for (const item of items) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: item.flavorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (stock) {
          const beforeQty = stock.quantity;
          const beforePostQty = stock.postQuantity ?? 0;
          stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
          stock.quantity = Math.max(0, stock.quantity - item.quantity);
          await logStockMovement(em, {
            shopId: session.shopId,
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
          throw new Error('DEBT_CUSTOMER_REQUIRED');
        }
        const debtCustomerName = debtCustomerCandidate;
        reservation.cashAmount = 0;
        reservation.cardAmount = 0;
        reservation.customerName = debtCustomerName;
        let debt = await em.getRepository(DebtEntity).findOne({
          where: { shopId: session.shopId, customerName: debtCustomerName },
        });
        if (!debt) {
          debt = em.getRepository(DebtEntity).create({
            shopId: session.shopId,
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

      return NextResponse.json({ message: 'Reservation sold successfully', sale: reservation });
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SPLIT_MISMATCH') {
        return NextResponse.json(
          { message: 'Сумма наличных и карты должна равняться итоговой сумме' },
          { status: 400 }
        );
      }
      if (err.message === 'DEBT_CUSTOMER_REQUIRED') {
        return NextResponse.json(
          { message: 'Для продажи в долг укажите клиента в резерве или в форме продажи' },
          { status: 400 }
        );
      }
    }
    throw err;
  }
}
