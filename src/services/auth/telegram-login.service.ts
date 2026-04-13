import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, type Shop, type User } from '@/lib/db/entities';
import { checkUserSubscription, canAccess } from '@/lib/auth-utils';
import { ensureUserHasShop } from '@/lib/ensure-user-shop';
import { generateAccessKey, generateReferralCode } from '@/lib/utils/crypto';
import {
  applyWendigoSuperadminToUser,
  isWendigoTarget,
} from '@/lib/superadmin-bootstrap';
import { getTrialDays } from '@/lib/system-settings';
import { createSignedSession } from '@/lib/session-token';
import { AppError } from '@/services/common/app-error';
import { ValidationError } from '@/services/common/domain-errors';
import { parseTelegramWebAppInitData } from '@/services/auth/telegram-init-data';

function userToTelegramLoginJson(user: User) {
  return {
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
  };
}

export type TelegramLoginResult = {
  user: ReturnType<typeof userToTelegramLoginJson>;
  shop: Shop;
  session: { userId: string; shopId: string; telegramId: string };
  subscriptionStatus: {
    hasActiveSubscription: boolean;
    isTrialExpired: boolean;
    canAccess: boolean;
  };
  signedSession: string;
};

export async function loginWithTelegramInitData(body: unknown): Promise<TelegramLoginResult> {
  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const initData = obj?.initData;
  if (!initData || typeof initData !== 'string') {
    throw new ValidationError('initData required');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new AppError('CONFIG', 'Bot not configured', 500);
  }

  const parsed = parseTelegramWebAppInitData(initData, botToken);
  if (!parsed) {
    throw new ValidationError('Authentication failed', undefined, {
      code: 'INVALID_INIT_DATA',
      status: 401,
    });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  let user = await userRepo.findOne({ where: { telegramId: parsed.telegramId } });

  if (!user) {
    const trialDays = await getTrialDays();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const accessKey = generateAccessKey();
    const referralCode = generateReferralCode();

    let referrerId: string | null = null;
    const sp = parsed.startParam?.trim();
    if (sp) {
      const referrer = await userRepo.findOne({ where: { referralCode: sp } });
      if (referrer && String(referrer.telegramId) !== String(parsed.telegramId)) {
        referrerId = referrer.id;
      }
    }

    user = userRepo.create({
      telegramId: parsed.telegramId,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      username: parsed.username ?? null,
      role: 'seller',
      accessKey,
      subscriptionStatus: 'trial',
      trialEndsAt,
      referralCode,
      referrerId,
      isActive: true,
    });
    await applyWendigoSuperadminToUser(userRepo, user);
    await userRepo.save(user);
  } else {
    if (parsed.firstName && user.firstName !== parsed.firstName) {
      user.firstName = parsed.firstName;
    }
    if (parsed.lastName && user.lastName !== parsed.lastName) {
      user.lastName = parsed.lastName;
    }
    if (parsed.username && user.username !== parsed.username) {
      user.username = parsed.username;
    }
    await applyWendigoSuperadminToUser(userRepo, user);
    if (!user.accessKey && !isWendigoTarget(user.telegramId, user.username)) {
      user.accessKey = generateAccessKey();
    }
    if (!user.referralCode) {
      user.referralCode = generateReferralCode();
    }
    await userRepo.save(user);
  }

  const shop = await ensureUserHasShop(ds, user);

  const session = {
    userId: String(user.id),
    shopId: String(shop.id),
    telegramId: String(user.telegramId ?? ''),
  };

  const userWithSub = await checkUserSubscription(user.id);
  const hasAccess = canAccess(userWithSub);

  return {
    user: userToTelegramLoginJson(user),
    shop,
    session,
    subscriptionStatus: {
      hasActiveSubscription: userWithSub?.hasActiveSubscription ?? false,
      isTrialExpired: userWithSub?.isTrialExpired ?? false,
      canAccess: hasAccess,
    },
    signedSession: createSignedSession(session),
  };
}
