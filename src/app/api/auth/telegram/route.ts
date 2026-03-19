import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDataSource } from '@/lib/db/data-source';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { UserEntity } from '@/lib/db/entities/User';
import { ShopEntity, type Shop } from '@/lib/db/entities/Shop';
import { UserShopEntity } from '@/lib/db/entities/UserShop';
import { generateAccessKey, generateReferralCode } from '@/lib/utils/crypto';
import { checkUserSubscription, canAccess } from '@/lib/auth-utils';
import { createSignedSession } from '@/lib/session-token';
import { ensureDefaultCategoriesForShop } from '@/lib/db/ensure-default-categories';

function validateInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(decodeURIComponent(userStr));
    return { telegramId: String(user.id), firstName: user.first_name, lastName: user.last_name, username: user.username };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { initData } = await request.json();
    if (!initData || typeof initData !== 'string') {
      return NextResponse.json({ message: 'initData required' }, { status: 400 });
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ message: 'Bot not configured' }, { status: 500 });
    }
    const parsed = validateInitData(initData, botToken);
    if (!parsed) {
      console.warn('[auth/telegram] Invalid initData signature or format');
      return NextResponse.json({ message: 'Authentication failed' }, { status: 401 });
    }
    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const shopRepo = ds.getRepository(ShopEntity);
    const userShopRepo = ds.getRepository(UserShopEntity);

    let user = await userRepo.findOne({ where: { telegramId: parsed.telegramId } });

    if (!user) {
      // Создаем пользователя с триалом (по умолчанию seller, если не указано иное)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 дней триала

      const accessKey = generateAccessKey();
      const referralCode = generateReferralCode();

      user = userRepo.create({
        telegramId: parsed.telegramId,
        firstName: parsed.firstName ?? null,
        lastName: parsed.lastName ?? null,
        username: parsed.username ?? null,
        role: 'seller', // По умолчанию seller, можно изменить через бота
        accessKey,
        subscriptionStatus: 'trial',
        trialEndsAt,
        referralCode,
        isActive: true,
      });
      await userRepo.save(user);
    } else {
      // Обновляем данные пользователя, если они изменились
      if (parsed.firstName && user.firstName !== parsed.firstName) {
        user.firstName = parsed.firstName;
      }
      if (parsed.lastName && user.lastName !== parsed.lastName) {
        user.lastName = parsed.lastName;
      }
      if (parsed.username && user.username !== parsed.username) {
        user.username = parsed.username;
      }
      // Генерируем accessKey, если его нет
      if (!user.accessKey) {
        user.accessKey = generateAccessKey();
      }
      // Генерируем referralCode, если его нет
      if (!user.referralCode) {
        user.referralCode = generateReferralCode();
      }
      await userRepo.save(user);
    }

    // Ищем магазин пользователя через UserShop или создаем новый
    let userShop = await userShopRepo.findOne({
      where: { userId: user.id },
    });

    let shop: Shop | null = null;
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

    await ensureDefaultCategoriesForShop(ds, shop.id);

    const session = {
      userId: String(user.id),
      shopId: String(shop.id),
      telegramId: String(user.telegramId ?? ''),
    };

    // Проверяем подписку после успешного логина
    const userWithSub = await checkUserSubscription(user.id);
    const hasAccess = canAccess(userWithSub);

    // Явный объект (без spread сущности) — клиент всегда получает accessKey для localStorage
    const res = NextResponse.json({
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        accessKey: user.accessKey,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
        referralCode: user.referralCode,
        referrerId: user.referrerId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      shop,
      session,
      subscriptionStatus: {
        hasActiveSubscription: userWithSub?.hasActiveSubscription ?? false,
        isTrialExpired: userWithSub?.isTrialExpired ?? false,
        canAccess: hasAccess,
      },
    });

    res.cookies.set('session', createSignedSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('[auth/telegram] Error:', e);
    return NextResponse.json({ message: 'Authentication failed' }, { status: 500 });
  }
}
