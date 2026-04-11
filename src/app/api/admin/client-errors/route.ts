import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { getDataSource } from '@/lib/db/data-source';
import { ClientErrorLogEntity } from '@/lib/db/entities';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '30', 10)));
  const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10));

  const ds = await getDataSource();
  const [rows, total] = await ds.getRepository(ClientErrorLogEntity).findAndCount({
    order: { createdAt: 'DESC' },
    take: limit,
    skip: offset,
  });

  return NextResponse.json({
    rows,
    total,
    limit,
    offset,
  });
}
