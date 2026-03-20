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
import {
  isTelegramUserNumericId,
  sendTelegramDocument,
} from '@/lib/telegram/send-document';
import path from 'path';
import fs from 'fs';
import os from 'os';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  if (!botToken) {
    return NextResponse.json({ message: 'Telegram bot not configured' }, { status: 500 });
  }

  if (!isTelegramUserNumericId(session.telegramId)) {
    return NextResponse.json(
      {
        message:
          'Отправка в Telegram недоступна: у аккаунта нет числового Telegram ID. Откройте приложение из Telegram или войдите через бота (не только по ключу с сайта).',
      },
      { status: 400 }
    );
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

    const sendResult = await sendTelegramDocument({
      botToken,
      chatId: session.telegramId.trim(),
      filePath: outputPath,
      filename: 'table.xlsx',
    });

    fs.unlinkSync(outputPath);

    if (!sendResult.ok) {
      console.error('Telegram sendDocument error:', {
        description: sendResult.description,
        errorCode: sendResult.errorCode,
        chatId: session.telegramId,
      });
      return NextResponse.json(
        { message: sendResult.description || 'Не удалось отправить файл в Telegram' },
        { status: 502 }
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
