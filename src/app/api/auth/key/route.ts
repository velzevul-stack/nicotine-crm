import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, ShopEntity, UserShopEntity, type User } from '@/lib/db/entities';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { createSignedSession } from '@/lib/session-token';
// import { checkUserSubscription, canAccess } from '@/lib/auth-utils'; // Используем упрощенную проверку
import { z } from 'zod';

const schema = z.object({
  accessKey: z.string().min(5),
});

/** Плоский JSON для ответа (без скрытых полей TypeORM / ссылок на сущности). */
function userToLoginJson(user: User) {
  const d = (v: Date | null | undefined) =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  return {
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    accessKey: user.accessKey,
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: d(user.trialEndsAt),
    subscriptionEndsAt: d(user.subscriptionEndsAt),
    referralCode: user.referralCode,
    referrerId: user.referrerId,
    isActive: user.isActive,
    createdAt: d(user.createdAt),
    updatedAt: d(user.updatedAt),
  };
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const startTime = Date.now();
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('[auth/key] Invalid JSON body:', parseErr);
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Authentication failed' }, { status: 400 });
    }

    const ds = await Promise.race([
      getDataSource(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 15000)
      )
    ]);
    const userRepo = ds.getRepository(UserEntity);
    const shopRepo = ds.getRepository(ShopEntity);
    const userShopRepo = ds.getRepository(UserShopEntity);

    // Обрезаем пробелы с начала и конца ключа
    const trimmedKey = parsed.data.accessKey.trim();
    
    // Ищем пользователя, проверяя ключ как есть (case-sensitive для точного совпадения)
    // Но также проверяем варианты с префиксом KEY- и без него, в разных регистрах
    let user = await userRepo.findOne({
      where: { accessKey: trimmedKey, isActive: true },
    });

    // Если не нашли, пробуем варианты:
    // 1. С префиксом KEY- в верхнем регистре
    if (!user) {
      const keyWithPrefix = trimmedKey.toUpperCase().startsWith('KEY-') 
        ? trimmedKey.toUpperCase() 
        : `KEY-${trimmedKey.toUpperCase()}`;
      user = await userRepo.findOne({
        where: { accessKey: keyWithPrefix, isActive: true },
      });
    }

    // 2. Без префикса KEY- (если был введен с префиксом)
    if (!user && trimmedKey.toUpperCase().startsWith('KEY-')) {
      const keyWithoutPrefix = trimmedKey.substring(4); // убираем "KEY-"
      user = await userRepo.findOne({
        where: { accessKey: keyWithoutPrefix, isActive: true },
      });
    }

    // 3. Точное совпадение без учета регистра (последняя попытка)
    if (!user) {
      // Используем QueryBuilder для case-insensitive поиска
      user = await userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.accessKey) = LOWER(:key)', { key: trimmedKey })
        .andWhere('user.isActive = :isActive', { isActive: true })
        .getOne();
    }

    if (!user) {
      // Проверяем, существует ли пользователь с таким ключом, но неактивный
      const inactiveUser = await userRepo.findOne({
        where: { accessKey: trimmedKey },
      });
      
      if (!inactiveUser) {
        // Пробуем найти неактивного пользователя без учета регистра
        const inactiveUserCaseInsensitive = await userRepo
          .createQueryBuilder('user')
          .where('LOWER(user.accessKey) = LOWER(:key)', { key: trimmedKey })
          .getOne();
        
        if (inactiveUserCaseInsensitive) {
          return NextResponse.json({ message: 'Account is inactive' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ message: 'Account is inactive' }, { status: 403 });
      }
      
      return NextResponse.json({ message: 'Authentication failed' }, { status: 401 });
    }

    // Find shop for user through UserShop relation
    let userShop = await userShopRepo.findOne({
      where: { userId: user.id },
    });

    // If no shop relation, try to find owned shop or create default
    if (!userShop) {
      let shop = await shopRepo.findOne({ where: { ownerId: user.id } });
      
      if (!shop) {
        // Create a new shop for the user
        shop = shopRepo.create({
          name: 'Мой магазин',
          timezone: 'Europe/Minsk',
          ownerId: user.id,
          currency: 'BYN',
          address: null,
        });
        await shopRepo.save(shop);
      }
      
      // Create UserShop relation
      userShop = await userShopRepo.save(userShopRepo.create({
        userId: user.id,
        shopId: shop.id,
        roleInShop: user.id === shop.ownerId ? 'owner' : 'seller'
      }));
    }

    const session = {
      userId: String(user.id),
      shopId: String(userShop.shopId),
      telegramId: String(user.telegramId ?? ''),
    };
    
    // Проверяем подписку после успешного логина (упрощенная проверка без транзакции)
    const now = new Date();
    const isTrialExpired = user.trialEndsAt ? new Date(user.trialEndsAt) < now : false;
    let hasActiveSubscription = false;
    
    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt) {
      hasActiveSubscription = new Date(user.subscriptionEndsAt) > now;
    } else if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
      hasActiveSubscription = new Date(user.trialEndsAt) > now;
    }
    
    // Админы всегда имеют доступ
    const hasAccess = user.role === 'admin' || (user.isActive && hasActiveSubscription);
    
    const signed = createSignedSession(session);

    const res = NextResponse.json({
      user: userToLoginJson(user),
      session,
      subscriptionStatus: {
        hasActiveSubscription,
        isTrialExpired,
        canAccess: hasAccess,
      },
    });

    res.cookies.set('session', signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[auth/key] Error after', Date.now() - startTime, 'ms:', msg);
    if (stack) console.error('[auth/key] stack:\n', stack);
    const errorMessage = msg || 'Internal server error';
    return NextResponse.json({ 
      message: errorMessage.includes('timeout') ? 'Request timeout. Please try again.' : 'Internal server error' 
    }, { status: 500 });
  }
}
