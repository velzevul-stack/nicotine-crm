import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { createCard, listCards } from '@/services/cards/cards.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const cards = await listCards({ shopId: session.shopId });
    return NextResponse.json(cards);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке карт');
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const card = await createCard({ shopId: session.shopId }, body);
    return NextResponse.json(card);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при создании карты');
  }
}
