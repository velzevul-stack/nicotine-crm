import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { listActiveReservationsForFlavor } from '@/services/reservations/sale-reservations.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flavorId: string }> },
) {
  const { flavorId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const reservations = await listActiveReservationsForFlavor(
      { shopId: session.shopId },
      flavorId,
    );
    return NextResponse.json(reservations);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке резерваций по вкусу');
  }
}
