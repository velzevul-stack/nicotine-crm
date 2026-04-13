import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { StockPatchHttpError } from '@/lib/inventory/stock-patch';
import { patchStockItem } from '@/services/inventory/inventory.stock.service';

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const item = await patchStockItem({ shopId: session.shopId }, body);
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof StockPatchHttpError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return serviceErrorResponse(e, 'Ошибка при обновлении остатка');
  }
}
