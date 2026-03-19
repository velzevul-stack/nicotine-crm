import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { ShopEntity } from '@/lib/db/entities';

// Получить настройки магазина
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const shopRepo = ds.getRepository(ShopEntity);
  
  const shop = await shopRepo.findOne({ where: { id: session.shopId } });
  
  if (!shop) {
    return NextResponse.json({ message: 'Shop not found' }, { status: 404 });
  }

  return NextResponse.json({
    defaultPostFormatId: shop.defaultPostFormatId || 'default',
  });
}

// Сохранить настройки магазина
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { defaultPostFormatId } = body;

    const ds = await getDataSource();
    const shopRepo = ds.getRepository(ShopEntity);
    
    const shop = await shopRepo.findOne({ where: { id: session.shopId } });
    
    if (!shop) {
      return NextResponse.json({ message: 'Shop not found' }, { status: 404 });
    }

    // Сохраняем выбранный формат поста (null для 'default')
    shop.defaultPostFormatId = defaultPostFormatId === 'default' ? null : defaultPostFormatId || null;
    await shopRepo.save(shop);

    return NextResponse.json({
      defaultPostFormatId: shop.defaultPostFormatId || 'default',
    });
  } catch (error) {
    console.error('Error saving shop settings:', error);
    return NextResponse.json(
      { message: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
