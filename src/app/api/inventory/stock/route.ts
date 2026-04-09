import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  applyStockPatchInTransaction,
  stockUpdateSchema,
  StockPatchHttpError,
} from '@/lib/inventory/stock-patch';

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = stockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  try {
    const item = await ds.transaction(async (em) =>
      applyStockPatchInTransaction(em, session.shopId, parsed.data)
    );
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof StockPatchHttpError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
