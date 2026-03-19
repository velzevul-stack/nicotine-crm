import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  DebtEntity,
  DebtOperationEntity,
} from '@/lib/db/entities';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const paymentType = body.paymentType || 'cash';

  const ds = await getDataSource();

  return ds.transaction(async (em) => {
    const reservation = await em.getRepository(SaleEntity).findOne({
      where: { id, shopId: session.shopId, isReservation: true },
    });

    if (!reservation) {
      return NextResponse.json({ message: 'Reservation not found' }, { status: 404 });
    }

    const items = await em.getRepository(SaleItemEntity).find({
      where: { saleId: reservation.id },
    });

    // Convert reservation to sale: move from reservedQuantity to sold (deduct from quantity)
    for (const item of items) {
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: session.shopId, flavorId: item.flavorId },
      });
      if (stock) {
        // Remove from reserved, deduct from total quantity
        stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
        stock.quantity = Math.max(0, stock.quantity - item.quantity);
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    // Update reservation to regular sale
    reservation.isReservation = false;
    reservation.paymentType = paymentType;
    reservation.status = 'active';
    const finalAmount = reservation.finalAmount;
    if (paymentType === 'cash') {
      reservation.cashAmount = finalAmount;
      reservation.cardAmount = 0;
    } else if (paymentType === 'card') {
      reservation.cashAmount = 0;
      reservation.cardAmount = finalAmount;
    } else if (paymentType === 'split') {
      const cash = body.cashAmount ?? 0;
      const card = body.cardAmount ?? 0;
      if (Math.abs(cash + card - finalAmount) <= 0.01) {
        reservation.cashAmount = cash;
        reservation.cardAmount = card;
      }
    } else if (paymentType === 'debt') {
      reservation.cashAmount = 0;
      reservation.cardAmount = 0;
      const customerName = reservation.reservationCustomerName?.trim() || body.customerName?.trim();
      if (customerName) {
        let debt = await em.getRepository(DebtEntity).findOne({
          where: { shopId: session.shopId, customerName },
        });
        if (!debt) {
          debt = em.getRepository(DebtEntity).create({
            shopId: session.shopId,
            customerName,
            totalDebt: 0,
          });
          await em.getRepository(DebtEntity).save(debt);
        }
        debt.totalDebt += finalAmount;
        await em.getRepository(DebtEntity).save(debt);
        const op = em.getRepository(DebtOperationEntity).create({
          debtId: debt.id,
          saleId: reservation.id,
          amount: finalAmount,
          datetime: new Date(),
          comment: `Продажа резерва #${reservation.id.slice(0, 8)}`,
        });
        await em.getRepository(DebtOperationEntity).save(op);
      }
    }
    await em.getRepository(SaleEntity).save(reservation);

    return NextResponse.json({ message: 'Reservation sold successfully', sale: reservation });
  });
}
