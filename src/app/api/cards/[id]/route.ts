import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { deleteCard, updateCard } from '@/services/cards/cards.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const card = await updateCard({ shopId: session.shopId }, id, body);
    return NextResponse.json(card);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при обновлении карты');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await deleteCard({ shopId: session.shopId }, id);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при удалении карты');
  }
}
