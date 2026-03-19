import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { ShopEntity } from '@/lib/db/entities';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  let shop = await ds.getRepository(ShopEntity).findOne({
    where: { id: session.shopId },
  });

  // Auto-create shop if it doesn't exist
  if (!shop) {
    const shopRepo = ds.getRepository(ShopEntity);
    // Try to find any shop for this user first
    let existingShop = await shopRepo.findOne({
      where: { ownerId: session.userId },
    });
    
    if (!existingShop) {
      // Create new shop
      shop = shopRepo.create({
        name: 'Мой магазин',
        timezone: 'Europe/Minsk',
        ownerId: session.userId,
        currency: 'BYN',
        address: null,
      });
      shop = await shopRepo.save(shop);
    } else {
      shop = existingShop;
    }
  }

  return NextResponse.json(shop);
}

const updateSchema = z.object({
  name: z.string().optional(),
  address: z.string().nullable().optional(),
  currency: z.enum(['BYN', 'USD', 'RUB']).optional(),
  timezone: z.string().optional(),
  supportTelegramUsername: z.string().nullable().optional(),
  country: z.enum(['RU', 'BY']).nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const shop = await ds.getRepository(ShopEntity).findOne({
    where: { id: session.shopId },
  });

  if (!shop) {
    return NextResponse.json({ message: 'Shop not found' }, { status: 404 });
  }

  if (parsed.data.name !== undefined) shop.name = parsed.data.name;
  if (parsed.data.address !== undefined) shop.address = parsed.data.address;
  if (parsed.data.currency !== undefined) shop.currency = parsed.data.currency;
  if (parsed.data.timezone !== undefined) shop.timezone = parsed.data.timezone;
  if (parsed.data.supportTelegramUsername !== undefined) shop.supportTelegramUsername = parsed.data.supportTelegramUsername;
  if (parsed.data.country !== undefined) shop.country = parsed.data.country;
  if (parsed.data.city !== undefined) shop.city = parsed.data.city;
  if (parsed.data.region !== undefined) shop.region = parsed.data.region;

  await ds.getRepository(ShopEntity).save(shop);

  return NextResponse.json(shop);
}
