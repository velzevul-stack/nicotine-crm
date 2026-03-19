import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { SaleEntity, SaleItemEntity, StockItemEntity } from '@/lib/db/entities';
import { In } from 'typeorm';
import { z } from 'zod';

const cancelReservationSchema = z.object({
  reservationId: z.string().uuid(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  const now = new Date();

  // Автозавершение истекших резервов перед выдачей активных
  await ds.transaction(async (em) => {
    const allReservations = await em.getRepository(SaleEntity).find({
      where: {
        shopId: session.shopId,
        isReservation: true,
        status: 'active',
      },
    });
    const expired = allReservations.filter(
      (r) => r.reservationExpiry && new Date(r.reservationExpiry) <= now
    );
    if (expired.length === 0) return;

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
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: item.flavorId },
        });
        if (stock) {
          stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
          await em.getRepository(StockItemEntity).save(stock);
        }
      }
      r.status = 'deleted';
      await em.getRepository(SaleEntity).save(r);
    }
  });

  // Получаем активные резервы (где reservationExpiry еще не наступил или null)
  const reservations = await ds.getRepository(SaleEntity).find({
    where: {
      shopId: session.shopId,
      isReservation: true,
      status: 'active',
    },
    order: { reservationExpiry: 'ASC' },
  });

  // Фильтруем только активные резервы (где expiry еще не наступил)
  const activeReservations = reservations.filter(
    (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > now
  );

  const reservationIds = activeReservations.map((r) => r.id);

  // Получаем все товары для этих резервов
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

  const reservationsWithItems = activeReservations.map((r) => ({
    ...r,
    items: itemsByReservationId.get(r.id) ?? [],
  }));

  return NextResponse.json(reservationsWithItems);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = cancelReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  return ds.transaction(async (em) => {
    const reservation = await em.getRepository(SaleEntity).findOne({
      where: {
        id: parsed.data.reservationId,
        shopId: session.shopId,
        isReservation: true,
        status: 'active',
      },
    });

    if (!reservation) {
      return NextResponse.json({ message: 'Reservation not found' }, { status: 404 });
    }

    // Получаем товары резерва
    const items = await em.getRepository(SaleItemEntity).find({
      where: { saleId: reservation.id },
    });

    // Возвращаем товары в прайс-лист (только уменьшаем reservedQuantity, quantity на складе не меняется)
    for (const item of items) {
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: session.shopId, flavorId: item.flavorId },
      });

      if (stock) {
        stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    // Помечаем резерв как удаленный
    reservation.status = 'deleted';
    await em.getRepository(SaleEntity).save(reservation);

    return NextResponse.json({ success: true });
  });
}

// POST endpoint для автоматического возврата истекших резервов
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  const now = new Date();

  return ds.transaction(async (em) => {
    // Находим все истекшие резервы
    const expiredReservations = await em.getRepository(SaleEntity).find({
      where: {
        shopId: session.shopId,
        isReservation: true,
        status: 'active',
      },
    });

    const expired = expiredReservations.filter(
      (r) => r.reservationExpiry && new Date(r.reservationExpiry) <= now
    );

    if (expired.length === 0) {
      return NextResponse.json({ returned: 0 });
    }

    const expiredIds = expired.map((r) => r.id);

    // Получаем товары истекших резервов
    const items = await em.getRepository(SaleItemEntity).find({
      where: { saleId: In(expiredIds) },
    });

    const itemsByReservationId = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByReservationId.get(item.saleId) ?? [];
      list.push(item);
      itemsByReservationId.set(item.saleId, list);
    }

    // Возвращаем товары в прайс-лист
    for (const reservation of expired) {
      const reservationItems = itemsByReservationId.get(reservation.id) ?? [];

      for (const item of reservationItems) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: item.flavorId },
        });

        if (stock) {
          stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
          await em.getRepository(StockItemEntity).save(stock);
        }
      }

      // Помечаем резерв как удаленный
      reservation.status = 'deleted';
      await em.getRepository(SaleEntity).save(reservation);
    }

    return NextResponse.json({ returned: expired.length });
  });
}
