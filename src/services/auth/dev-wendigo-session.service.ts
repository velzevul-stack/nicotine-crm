import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, type Shop, type User } from '@/lib/db/entities';
import { ensureUserHasShop } from '@/lib/ensure-user-shop';
import { generateReferralCode } from '@/lib/utils/crypto';
import { createSignedSession } from '@/lib/session-token';
import {
  WENDIGO_TELEGRAM_ID,
  WENDIGO_TELEGRAM_USERNAME,
  applyWendigoSuperadminToUser,
} from '@/lib/superadmin-bootstrap';
import { ForbiddenError } from '@/services/common/domain-errors';

export type DevWendigoSessionResult = {
  user: User;
  shop: Shop;
  session: { userId: string; shopId: string; telegramId: string };
  signedSession: string;
};

/** Только `NODE_ENV=development`: сессия под пользователем wendigo для общего магазина с мини-приложением. */
export async function createDevWendigoSession(): Promise<DevWendigoSessionResult> {
  if (process.env.NODE_ENV !== 'development') {
    throw new ForbiddenError('Not available');
  }

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

  const shop = await ensureUserHasShop(ds, user);

  const session = {
    userId: String(user.id),
    shopId: String(shop.id),
    telegramId: String(user.telegramId ?? ''),
  };

  return {
    user,
    shop,
    session,
    signedSession: createSignedSession(session),
  };
}
