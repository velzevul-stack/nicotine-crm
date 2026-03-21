/**
 * DEV-only: create session without Telegram initData.
 * Uses the same DB user as Telegram mini app for wendigo (WENDIGO_TELEGRAM_ID), so web and app share one shop.
 * Only works when NODE_ENV=development.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, type Shop } from '@/lib/db/entities';
import { generateReferralCode } from '@/lib/utils/crypto';
import { createSignedSession } from '@/lib/session-token';
import { ensureUserHasShop } from '@/lib/ensure-user-shop';
import {
  WENDIGO_TELEGRAM_ID,
  WENDIGO_TELEGRAM_USERNAME,
  applyWendigoSuperadminToUser,
} from '@/lib/superadmin-bootstrap';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ message: 'Not available' }, { status: 403 });
  }

  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  let user = await userRepo.findOne({ where: { telegramId: WENDIGO_TELEGRAM_ID } });

  if (!user) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const referralCode = generateReferralCode();

    user = userRepo.create({
      telegramId: WENDIGO_TELEGRAM_ID,
      firstName: 'Wendigo',
      lastName: null,
      username: WENDIGO_TELEGRAM_USERNAME,
      role: 'seller',
      accessKey: null,
      subscriptionStatus: 'trial',
      trialEndsAt,
      referralCode,
      isActive: true,
    });
    await applyWendigoSuperadminToUser(userRepo, user);
    await userRepo.save(user);
  } else {
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
    await applyWendigoSuperadminToUser(userRepo, user);
    await userRepo.save(user);
  }

  const shop: Shop = await ensureUserHasShop(ds, user);

  const session = {
    userId: String(user.id),
    shopId: String(shop.id),
    telegramId: String(user.telegramId ?? ''),
  };
  const res = NextResponse.json({ user, shop, session });

  res.cookies.set('session', createSignedSession(session), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
