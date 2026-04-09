import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { FlavorEntity, StockItemEntity, ProductFormatEntity, SaleItemEntity } from '@/lib/db/entities';
import { z } from 'zod';

const PRICE_EPS = 0.005;
const normalizeName = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim();
const normalizeNameKey = (v: string) => normalizeName(v).toLowerCase();
const normalizeBarcode = (v: string) =>
  v.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  costPrice: z.number().finite().min(0, { message: 'Себестоимость не может быть отрицательной' }).optional(),
  unitPrice: z.number().min(0).optional(), // Updates the format!
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flavorId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  
  return ds.transaction(async (em) => {
    // 1. Update Flavor
    const flavorRepo = em.getRepository(FlavorEntity);
    let flavor = await flavorRepo.findOne({
      where: { id: flavorId, shopId: session.shopId },
    });

    if (!flavor) {
      return NextResponse.json({ message: 'Flavor not found' }, { status: 404 });
    }

    if (parsed.data.name !== undefined) {
      flavor.name = normalizeName(parsed.data.name);
      flavor.normalizedName = normalizeNameKey(parsed.data.name);
    }
    if (parsed.data.barcode !== undefined) {
      flavor.barcode = parsed.data.barcode ? normalizeBarcode(parsed.data.barcode) : parsed.data.barcode;
    }
    if (parsed.data.isActive !== undefined) flavor.isActive = parsed.data.isActive;

    const nextCostPrice = parsed.data.costPrice;
    const nextUnitPrice = parsed.data.unitPrice;
    if (nextCostPrice !== undefined || nextUnitPrice !== undefined) {
      const stockRepo = em.getRepository(StockItemEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const [stock, format] = await Promise.all([
        stockRepo.findOne({ where: { flavorId: flavorId, shopId: session.shopId } }),
        formatRepo.findOne({ where: { id: flavor.productFormatId, shopId: session.shopId } }),
      ]);
      const effectiveCost = nextCostPrice ?? (stock?.costPrice ?? 0);
      const effectiveUnit = nextUnitPrice ?? (format?.unitPrice ?? 0);
      if (effectiveCost > effectiveUnit + PRICE_EPS) {
        return NextResponse.json(
          { message: 'Себестоимость не может быть больше розничной цены' },
          { status: 400 }
        );
      }
    }

    await flavorRepo.save(flavor);

    // 2. Update StockItem (costPrice)
    if (parsed.data.costPrice !== undefined) {
      const stockRepo = em.getRepository(StockItemEntity);
      let stock = await stockRepo.findOne({
        where: { flavorId: flavorId, shopId: session.shopId },
      });

      if (!stock) {
        stock = stockRepo.create({
          shopId: session.shopId,
          flavorId: flavorId,
          quantity: 0,
          costPrice: parsed.data.costPrice,
        });
      } else {
        stock.costPrice = parsed.data.costPrice;
      }
      await stockRepo.save(stock);
    }

    // 3. Update ProductFormat (unitPrice)
    if (parsed.data.unitPrice !== undefined) {
      const formatRepo = em.getRepository(ProductFormatEntity);
      let format = await formatRepo.findOne({
        where: { id: flavor.productFormatId, shopId: session.shopId },
      });

      if (format) {
        format.unitPrice = parsed.data.unitPrice;
        await formatRepo.save(format);
      }
    }

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flavorId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  
  return ds.transaction(async (em) => {
    const flavorRepo = em.getRepository(FlavorEntity);
    const stockRepo = em.getRepository(StockItemEntity);
    const saleItemRepo = em.getRepository(SaleItemEntity);

    const flavor = await flavorRepo.findOne({
      where: { id: flavorId, shopId: session.shopId },
    });

    if (!flavor) {
      return NextResponse.json({ message: 'Flavor not found' }, { status: 404 });
    }

    // Проверяем, есть ли остатки на складе
    const stockItem = await stockRepo.findOne({
      where: { flavorId: flavorId, shopId: session.shopId },
    });

    if (stockItem && stockItem.quantity > 0) {
      return NextResponse.json(
        { 
          message: `Невозможно удалить вкус: на складе осталось ${stockItem.quantity} шт. Сначала продайте или списыте весь товар.` 
        },
        { status: 400 }
      );
    }

    // Проверяем, есть ли связанные продажи (для истории)
    const salesCount = await saleItemRepo.count({
      where: { flavorId: flavorId },
    });

    if (salesCount > 0) {
      // Можно удалить вкус, но предупредить, что история продаж сохранится
      // Или можно запретить удаление, если есть продажи
      // Для MVP разрешим удаление, но предупредим
    }

    // Удаляем StockItem если существует
    if (stockItem) {
      await stockRepo.remove(stockItem);
    }

    // Удаляем Flavor
    await flavorRepo.remove(flavor);

    return NextResponse.json({ success: true });
  });
}
