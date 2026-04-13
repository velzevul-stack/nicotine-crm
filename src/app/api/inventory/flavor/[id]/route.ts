import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { deleteFlavor, updateFlavor } from '@/services/inventory/inventory.flavor.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: flavorId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await updateFlavor({ shopId: session.shopId }, flavorId, body);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при обновлении вкуса');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: flavorId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await deleteFlavor({ shopId: session.shopId }, flavorId);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при удалении вкуса');
  }
}
