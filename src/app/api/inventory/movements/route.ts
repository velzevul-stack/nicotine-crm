import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { StockMovementEntity } from '@/lib/db/entities';

function parseDateParam(value: string, endOfDay = false): Date | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const dt = dateOnly
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 100);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 500)) : 100;
  const categoryId = request.nextUrl.searchParams.get('categoryId');
  const actionType = request.nextUrl.searchParams.get('actionType');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  const ds = await getDataSource();
  const qb = ds
    .getRepository(StockMovementEntity)
    .createQueryBuilder('m')
    .leftJoin('flavors', 'f', 'f.id = m.productId AND f."shopId" = :shopId', { shopId: session.shopId })
    .leftJoin('product_formats', 'pf', 'pf.id = f."productFormatId" AND pf."shopId" = :shopId', { shopId: session.shopId })
    .leftJoin('brands', 'b', 'b.id = pf."brandId" AND b."shopId" = :shopId', { shopId: session.shopId })
    .leftJoin('categories', 'c', 'c.id = b."categoryId" AND c."shopId" = :shopId', { shopId: session.shopId })
    .where('m.shopId = :shopId', { shopId: session.shopId })
    .orderBy('m.createdAt', 'DESC')
    .take(limit);

  if (categoryId) qb.andWhere('c.id = :categoryId', { categoryId });
  if (actionType) qb.andWhere('m.actionType = :actionType', { actionType });
  if (from) {
    const fromDate = parseDateParam(from, false);
    if (fromDate) {
      qb.andWhere('m.createdAt >= :from', { from: fromDate.toISOString() });
    }
  }
  if (to) {
    const toDate = parseDateParam(to, true);
    if (toDate) {
      qb.andWhere('m.createdAt <= :to', { to: toDate.toISOString() });
    }
  }

  const rows = await qb.getMany();

  const categoryRows = await ds
    .createQueryBuilder()
    .select('c.id', 'categoryId')
    .addSelect('c.name', 'categoryName')
    .addSelect('c.emoji', 'categoryEmoji')
    .from('stock_movements', 'm')
    .leftJoin('flavors', 'f', 'f.id = m."productId" AND f."shopId" = :shopId', { shopId: session.shopId })
    .leftJoin('product_formats', 'pf', 'pf.id = f."productFormatId" AND pf."shopId" = :shopId', { shopId: session.shopId })
    .leftJoin('brands', 'b', 'b.id = pf."brandId" AND b."shopId" = :shopId', { shopId: session.shopId })
    .leftJoin('categories', 'c', 'c.id = b."categoryId" AND c."shopId" = :shopId', { shopId: session.shopId })
    .where('m."shopId" = :shopId', { shopId: session.shopId })
    .andWhere('c.id IS NOT NULL')
    .groupBy('c.id')
    .addGroupBy('c.name')
    .addGroupBy('c.emoji')
    .orderBy('c.name', 'ASC')
    .getRawMany<{ categoryId: string; categoryName: string; categoryEmoji: string | null }>();

  const categories = categoryRows.map((c) => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    categoryEmoji: c.categoryEmoji,
  }));

  return NextResponse.json({ rows, categories });
}
