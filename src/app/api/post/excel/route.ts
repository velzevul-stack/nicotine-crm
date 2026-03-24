import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
  ShopEntity,
} from '@/lib/db/entities';
import { generateStockTable } from '@/lib/excel/table-generator';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const includeBrandPhotos = body.includeBrandPhotos !== false;

  const ds = await getDataSource();

  const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);
    const brandRepo = em.getRepository(BrandEntity);
    const formatRepo = em.getRepository(ProductFormatEntity);
    const flavorRepo = em.getRepository(FlavorEntity);
    const stockRepo = em.getRepository(StockItemEntity);

    return Promise.all([
      categoryRepo.find({
        where: { shopId: session.shopId },
        order: { sortOrder: 'ASC' },
      }),
      brandRepo.find({
        where: { shopId: session.shopId },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      formatRepo.find({
        where: { shopId: session.shopId, isActive: true },
        order: { name: 'ASC' },
      }),
      flavorRepo.find({
        where: { shopId: session.shopId, isActive: true },
        order: { name: 'ASC' },
      }),
      stockRepo.find({ where: { shopId: session.shopId } }),
    ]);
  });

  const shop = await ds.getRepository(ShopEntity).findOne({
    where: { id: session.shopId },
  });

  const outputPath = path.join(os.tmpdir(), `stock-table-${session.shopId}-${Date.now()}.xlsx`);

  try {
    await generateStockTable(
      {
        currencyCode: shop?.currency ?? 'BYN',
        categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji || '' })),
        brands: brands.map((b) => ({
          id: b.id,
          name: b.name,
          emojiPrefix: b.emojiPrefix || '',
          photoUrl: (b as any).photoUrl ?? null,
          categoryId: b.categoryId,
        })),
        formats: formats.map((f) => ({
          id: f.id,
          brandId: f.brandId,
          name: f.name,
          strengthLabel: f.strengthLabel || '',
          unitPrice: f.unitPrice,
          isLiquid: (f as any).isLiquid ?? true,
        })),
        flavors: flavors.map((f) => ({
          id: f.id,
          productFormatId: f.productFormatId,
          name: f.name,
        })),
        stocks: stocks.map((s) => ({ flavorId: s.flavorId, quantity: s.quantity })),
        includeBrandPhotos,
      },
      outputPath
    );

    const buffer = fs.readFileSync(outputPath);
    fs.unlinkSync(outputPath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="table.xlsx"`,
      },
    });
  } catch (err) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    console.error('Excel generation error:', err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Excel generation failed' },
      { status: 500 }
    );
  }
}
