import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { StockPatchHttpError } from '@/lib/inventory/stock-patch';
import { receiveStockBatch } from '@/services/inventory/inventory.stock-batch.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await receiveStockBatch({ shopId: session.shopId }, body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof StockPatchHttpError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return serviceErrorResponse(e, 'Ошибка при пакетной приёмке');
  }
}
