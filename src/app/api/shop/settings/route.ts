import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  getShopPostFormatSettings,
  updateShopPostFormatSettings,
} from '@/services/shop/shop.service';

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await getShopPostFormatSettings({
      shopId: session.shopId,
      userId: session.userId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке настроек магазина');
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await updateShopPostFormatSettings(
      { shopId: session.shopId, userId: session.userId },
      body,
    );
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при сохранении настроек магазина');
  }
}
