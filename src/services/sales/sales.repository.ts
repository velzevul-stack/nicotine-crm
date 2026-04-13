import { In, type DataSource } from 'typeorm';
import { SaleEntity, SaleItemEntity, type Sale, type SaleItem } from '@/lib/db/entities';

export async function querySalesListForShop(
  ds: DataSource,
  shopId: string,
  from?: string | null,
  to?: string | null,
): Promise<Sale[]> {
  const qb = ds
    .getRepository(SaleEntity)
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId })
    .andWhere('s.status != :status', { status: 'deleted' })
    .orderBy('s.datetime', 'DESC');
  if (from) qb.andWhere('s.datetime >= :from', { from });
  if (to) qb.andWhere('s.datetime <= :to', { to });
  return qb.take(100).getMany();
}

export async function findSaleItemsBySaleIds(ds: DataSource, saleIds: string[]): Promise<SaleItem[]> {
  if (saleIds.length === 0) return [];
  return ds.getRepository(SaleItemEntity).find({ where: { saleId: In(saleIds) } });
}

export async function findSaleByIdForShop(ds: DataSource, shopId: string, id: string): Promise<Sale | null> {
  return ds.getRepository(SaleEntity).findOne({ where: { id, shopId } });
}

export async function findSaleItemsForSaleId(ds: DataSource, saleId: string): Promise<SaleItem[]> {
  return ds.getRepository(SaleItemEntity).find({ where: { saleId } });
}
