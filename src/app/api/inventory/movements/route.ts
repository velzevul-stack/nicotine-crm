import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { StockMovementEntity } from '@/lib/db/entities';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 100), 500);
  const productId = request.nextUrl.searchParams.get('productId');
  const actionType = request.nextUrl.searchParams.get('actionType');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  const ds = await getDataSource();
  const qb = ds
    .getRepository(StockMovementEntity)
    .createQueryBuilder('m')
    .where('m.shopId = :shopId', { shopId: session.shopId })
    .orderBy('m.createdAt', 'DESC')
    .take(limit);

  if (productId) qb.andWhere('m.productId = :productId', { productId });
  if (actionType) qb.andWhere('m.actionType = :actionType', { actionType });
  if (from) qb.andWhere('m.createdAt >= :from', { from: new Date(from).toISOString() });
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    qb.andWhere('m.createdAt <= :to', { to: toDate.toISOString() });
  }

  const rows = await qb.getMany();
  return NextResponse.json(rows);
}
