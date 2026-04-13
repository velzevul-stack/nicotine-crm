import { In, type DataSource } from 'typeorm';
import { ShopEntity, CardEntity, SaleEntity, SaleItemEntity, type Sale, type SaleItem } from '@/lib/db/entities';
import { DEFAULT_SHOP_TZ } from '@/services/reports/reports.constants';

export async function resolveShopTimeZone(ds: DataSource, shopId: string): Promise<string> {
  const shop = await ds.getRepository(ShopEntity).findOne({ where: { id: shopId } });
  return shop?.timezone && shop.timezone.trim() ? shop.timezone.trim() : DEFAULT_SHOP_TZ;
}

export async function loadCardsForShop(ds: DataSource, shopId: string) {
  return ds.getRepository(CardEntity).find({
    where: { shopId },
    order: { sortOrder: 'ASC', name: 'ASC' },
  });
}

export async function loadSalesInReportRange(
  ds: DataSource,
  input: { shopId: string; from: Date; to: Date; reservationsOnly: boolean },
): Promise<Sale[]> {
  const qb = ds
    .getRepository(SaleEntity)
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId: input.shopId })
    .andWhere('s.status != :status', { status: 'deleted' })
    .andWhere('s.datetime >= :from', { from: input.from })
    .andWhere('s.datetime <= :to', { to: input.to });
  if (input.reservationsOnly) {
    qb.andWhere('s.isReservation = :isReservation', { isReservation: true });
  }
  return qb.orderBy('s.datetime', 'DESC').getMany();
}

export async function loadSaleItemsBySaleIds(ds: DataSource, saleIds: string[]): Promise<SaleItem[]> {
  if (saleIds.length === 0) return [];
  return ds.getRepository(SaleItemEntity).find({ where: { saleId: In(saleIds) } });
}
