import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { getShopOrCreateForSession, updateShop } from '@/services/shop/shop.service';

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const shop = await getShopOrCreateForSession({
      shopId: session.shopId,
      userId: session.userId,
    });
    return NextResponse.json(shop);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке магазина');
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const shop = await updateShop(
      { shopId: session.shopId, userId: session.userId },
      body,
    );
    return NextResponse.json(shop);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при обновлении магазина');
  }
}
