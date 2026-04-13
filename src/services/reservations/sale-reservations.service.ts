import { getDataSource } from '@/lib/db/data-source';
import { SaleEntity, SaleItemEntity } from '@/lib/db/entities';
import type { ShopContext } from '@/services/common/service-context';
import { In } from 'typeorm';

/** Резервации для UI продаж (включая истекающие по статусу, кроме deleted). */
export async function listReservationsForSalesUi(context: ShopContext) {
  const ds = await getDataSource();

  const reservations = await ds
    .getRepository(SaleEntity)
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId: context.shopId })
    .andWhere('s.isReservation = :isReservation', { isReservation: true })
    .andWhere('s.status != :status', { status: 'deleted' })
    .orderBy('s.reservationExpiry', 'ASC')
    .getMany();

  const reservationIds = reservations.map((r) => r.id);
  const items =
    reservationIds.length > 0
      ? await ds.getRepository(SaleItemEntity).find({
          where: { saleId: In(reservationIds) },
        })
      : [];

  const itemsByReservationId = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByReservationId.get(it.saleId) ?? [];
    list.push(it);
    itemsByReservationId.set(it.saleId, list);
  }

  return reservations.map((r) => ({
    ...r,
    items: itemsByReservationId.get(r.id) ?? [],
  }));
}

/** Активные резервации магазина, в которых участвует вкус (для подсказок в форме). */
export async function listActiveReservationsForFlavor(context: ShopContext, flavorId: string) {
  const ds = await getDataSource();

  const saleItems = await ds.getRepository(SaleItemEntity).find({
    where: { flavorId },
  });

  const saleIds = [...new Set(saleItems.map((si) => si.saleId))];

  if (saleIds.length === 0) {
    return [];
  }

  return ds.getRepository(SaleEntity).find({
    where: {
      id: In(saleIds),
      shopId: context.shopId,
      isReservation: true,
      status: 'active',
    },
  });
}
