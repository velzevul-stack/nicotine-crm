import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { SaleEntity, SaleItemEntity } from '@/lib/db/entities';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  
  const reservations = await ds
    .getRepository(SaleEntity)
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId: session.shopId })
    .andWhere('s.isReservation = :isReservation', { isReservation: true })
    .andWhere('s.status != :status', { status: 'deleted' })
    .orderBy('s.reservationExpiry', 'ASC')
    .getMany();

  const reservationIds = reservations.map((r) => r.id);
  const items =
    reservationIds.length > 0
      ? await ds.getRepository(SaleItemEntity).find({
          where: { saleId: reservationIds as any },
        })
      : [];

  const itemsByReservationId = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByReservationId.get(it.saleId) ?? [];
    list.push(it);
    itemsByReservationId.set(it.saleId, list);
  }

  const reservationsWithItems = reservations.map((r) => ({
    ...r,
    items: itemsByReservationId.get(r.id) ?? [],
  }));

  return NextResponse.json(reservationsWithItems);
}
