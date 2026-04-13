import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { listReservationsForSalesUi } from '@/services/reservations/sale-reservations.service';

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const reservationsWithItems = await listReservationsForSalesUi({ shopId: session.shopId });
    return NextResponse.json(reservationsWithItems);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке резерваций');
  }
}
