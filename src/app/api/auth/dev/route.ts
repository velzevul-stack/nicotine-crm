/**
 * DEV-only: create session without Telegram initData.
 * Only works when NODE_ENV=development.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, ShopEntity, UserShopEntity, type Shop } from '@/lib/db/entities';
import { generateAccessKey, generateReferralCode } from '@/lib/utils/crypto';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ message: 'Not available' }, { status: 403 });
  }

  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const shopRepo = ds.getRepository(ShopEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);

  let user = await userRepo.findOne({ where: { telegramId: 'dev-user-1' } });

  if (!user) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 дней триала

    const accessKey = generateAccessKey();
    const referralCode = generateReferralCode();

    user = userRepo.create({
      telegramId: 'dev-user-1',
      firstName: 'Алексей',
      lastName: null,
      username: 'dev_seller',
      role: 'seller',
      accessKey,
      subscriptionStatus: 'trial',
      trialEndsAt,
      referralCode,
      isActive: true,
    });
    await userRepo.save(user);
  } else {
    // Обновляем поля, если их нет
    if (!user.accessKey) {
      user.accessKey = generateAccessKey();
    }
    if (!user.referralCode) {
      user.referralCode = generateReferralCode();
    }
    if (!user.trialEndsAt) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      user.trialEndsAt = trialEndsAt;
    }
    if (!user.subscriptionStatus) {
      user.subscriptionStatus = 'trial';
    }
    await userRepo.save(user);
  }

  // Ищем магазин пользователя через UserShop или создаем новый
  let userShop = await userShopRepo.findOne({
    where: { userId: user.id },
  });

  let shop: ShopEntity | null = null;
  if (userShop) {
    shop = await shopRepo.findOne({ where: { id: userShop.shopId } });
  }

  // Если нет магазина, создаем новый для пользователя
  if (!shop) {
    shop = shopRepo.create({
      name: 'Мой магазин',
      timezone: 'Europe/Minsk',
      ownerId: user.id,
      currency: 'BYN',
      address: null,
    });
    await shopRepo.save(shop);

    // Создаем связь UserShop
    userShop = userShopRepo.create({
      userId: user.id,
      shopId: shop.id,
      roleInShop: 'owner',
    });
    await userShopRepo.save(userShop);
  } else if (!userShop) {
    // Если магазин есть, но связи нет - создаем связь
    userShop = userShopRepo.create({
      userId: user.id,
      shopId: shop.id,
      roleInShop: user.id === shop.ownerId ? 'owner' : 'seller',
    });
    await userShopRepo.save(userShop);
  }

  const session = { userId: user.id, shopId: shop.id, telegramId: user.telegramId };
  const res = NextResponse.json({ user, shop, session });
  
  // Используем подписанную сессию
  const { createSignedSession } = require('@/lib/auth');
  res.cookies.set('session', createSignedSession(session), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
