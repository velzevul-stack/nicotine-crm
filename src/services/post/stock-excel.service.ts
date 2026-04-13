import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDataSource } from '@/lib/db/data-source';
import {
  BrandEntity,
  CategoryEntity,
  FlavorEntity,
  ProductFormatEntity,
  ShopEntity,
  StockItemEntity,
} from '@/lib/db/entities';
import { generateStockTable } from '@/lib/excel/table-generator';

export type StockExcelBuildOptions = {
  includeBrandPhotos: boolean;
};

export async function buildStockExcelBuffer(
  shopId: string,
  options: StockExcelBuildOptions,
): Promise<Buffer> {
  const ds = await getDataSource();

  const categoryRepo = ds.getRepository(CategoryEntity);
  const brandRepo = ds.getRepository(BrandEntity);
  const formatRepo = ds.getRepository(ProductFormatEntity);
  const flavorRepo = ds.getRepository(FlavorEntity);
  const stockRepo = ds.getRepository(StockItemEntity);

  const [categories, brands, formats, flavors, stocks] = await Promise.all([
    categoryRepo.find({
      where: { shopId },
      order: { sortOrder: 'ASC' },
    }),
    brandRepo.find({
      where: { shopId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    }),
    formatRepo.find({
      where: { shopId, isActive: true },
      order: { name: 'ASC' },
    }),
    flavorRepo.find({
      where: { shopId, isActive: true },
      order: { name: 'ASC' },
    }),
    stockRepo.find({ where: { shopId } }),
  ]);

  const shop = await ds.getRepository(ShopEntity).findOne({
    where: { id: shopId },
  });

  const outputPath = path.join(os.tmpdir(), `stock-table-${shopId}-${Date.now()}.xlsx`);

  try {
    await generateStockTable(
      {
        currencyCode: shop?.currency ?? 'BYN',
        categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji || '' })),
        brands: brands.map((b) => ({
          id: b.id,
          name: b.name,
          emojiPrefix: b.emojiPrefix || '',
          photoUrl: b.photoUrl ?? null,
          categoryId: b.categoryId,
        })),
        formats: formats.map((f) => ({
          id: f.id,
          brandId: f.brandId,
          name: f.name,
          strengthLabel: f.strengthLabel || '',
          unitPrice: f.unitPrice,
          isLiquid: f.isLiquid ?? true,
        })),
        flavors: flavors.map((f) => ({
          id: f.id,
          productFormatId: f.productFormatId,
          name: f.name,
        })),
        stocks: stocks.map((s) => ({ flavorId: s.flavorId, quantity: s.quantity })),
        includeBrandPhotos: options.includeBrandPhotos,
      },
      outputPath,
    );

    return fs.readFileSync(outputPath);
  } finally {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}
