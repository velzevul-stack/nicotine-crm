import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
} from '@/lib/db/entities';
import { generateStockTable } from '@/lib/excel/table-generator';
import path from 'path';
import fs from 'fs';
import os from 'os';
import FormData from 'form-data';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  if (!botToken) {
    return NextResponse.json({ message: 'Telegram bot not configured' }, { status: 500 });
  }

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

  const outputPath = path.join(os.tmpdir(), `stock-table-${session.shopId}-${Date.now()}.xlsx`);

  try {
    await generateStockTable(
      {
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

    const formData = new FormData();
    formData.append('chat_id', session.telegramId);
    formData.append('document', fs.createReadStream(outputPath), 'table.xlsx');

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData as any,
      headers: formData.getHeaders(),
    });

    fs.unlinkSync(outputPath);

    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram sendDocument error:', err);
      return NextResponse.json(
        { message: 'Failed to send to Telegram' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    console.error('Excel send-telegram error:', err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to send Excel to Telegram' },
      { status: 500 }
    );
  }
}
