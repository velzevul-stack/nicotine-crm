import type { DataSource } from 'typeorm';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
} from '@/lib/db/entities';
import type { Brand, Category, Flavor, ProductFormat, StockItem } from '@/lib/db/entities';

export type InventoryBaseRows = {
  categories: Category[];
  brands: Brand[];
  formats: ProductFormat[];
  flavors: Flavor[];
  stocks: StockItem[];
};

/** Параллельная загрузка сырья для снимка инвентаря (без транзакции — разные соединения пула). */
export async function loadInventoryBaseRows(ds: DataSource, shopId: string): Promise<InventoryBaseRows> {
  const categoryRepo = ds.getRepository(CategoryEntity);
  const brandRepo = ds.getRepository(BrandEntity);
  const formatRepo = ds.getRepository(ProductFormatEntity);
  const flavorRepo = ds.getRepository(FlavorEntity);
  const stockRepo = ds.getRepository(StockItemEntity);

  const [categories, brands, formats, flavors, stocks] = await Promise.all([
    categoryRepo.find({ where: { shopId }, order: { sortOrder: 'ASC' } }),
    brandRepo.find({ where: { shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
    formatRepo.find({ where: { shopId }, order: { name: 'ASC' } }),
    flavorRepo.find({ where: { shopId }, order: { name: 'ASC' } }),
    stockRepo.find({ where: { shopId } }),
  ]);

  return { categories, brands, formats, flavors, stocks };
}
