import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  cancelReservation,
  expireStaleReservationsNow,
  listActiveReservations,
} from '@/services/reserves/reserves.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const reservationsWithItems = await listActiveReservations({ shopId: session.shopId });
    return NextResponse.json(reservationsWithItems);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке резервов');
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await cancelReservation({ shopId: session.shopId }, body);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при отмене резерва');
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await expireStaleReservationsNow({ shopId: session.shopId });
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при возврате резервов');
  }
}
