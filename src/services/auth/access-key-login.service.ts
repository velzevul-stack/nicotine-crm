import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, type User } from '@/lib/db/entities';
import type { Repository } from 'typeorm';
import { ensureUserHasShop } from '@/lib/ensure-user-shop';
import { createSignedSession } from '@/lib/session-token';
import { ForbiddenError, ValidationError } from '@/services/common/domain-errors';
import { accessKeyLoginSchema } from '@/services/auth/access-key-login.validators';

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

export type AccessKeyLoginResult = {
  user: ReturnType<typeof userToLoginJson>;
  session: { userId: string; shopId: string; telegramId: string };
  subscriptionStatus: {
    hasActiveSubscription: boolean;
    isTrialExpired: boolean;
    canAccess: boolean;
  };
  signedSession: string;
};

async function resolveUserByAccessKey(
  userRepo: Repository<User>,
  trimmedKey: string,
): Promise<User | null> {
  let user = await userRepo.findOne({
    where: { accessKey: trimmedKey, isActive: true },
  });

  if (!user) {
    const keyWithPrefix = trimmedKey.toUpperCase().startsWith('KEY-')
      ? trimmedKey.toUpperCase()
      : `KEY-${trimmedKey.toUpperCase()}`;
    user = await userRepo.findOne({
      where: { accessKey: keyWithPrefix, isActive: true },
    });
  }

  if (!user && trimmedKey.toUpperCase().startsWith('KEY-')) {
    const keyWithoutPrefix = trimmedKey.substring(4);
    user = await userRepo.findOne({
      where: { accessKey: keyWithoutPrefix, isActive: true },
    });
  }

  if (!user) {
    user = await userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.accessKey) = LOWER(:key)', { key: trimmedKey })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
  }

  return user;
}

export async function loginWithAccessKey(body: unknown): Promise<AccessKeyLoginResult> {
  const parsed = accessKeyLoginSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Authentication failed', undefined, {
      code: 'INVALID_BODY',
      status: 400,
    });
  }

  const ds = await Promise.race([
    getDataSource(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 15000),
    ),
  ]);

  const userRepo = ds.getRepository(UserEntity);
  const trimmedKey = parsed.data.accessKey.trim();
  let user = await resolveUserByAccessKey(userRepo, trimmedKey);

  if (!user) {
    const inactiveUser = await userRepo.findOne({
      where: { accessKey: trimmedKey },
    });

    if (!inactiveUser) {
      const inactiveUserCaseInsensitive = await userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.accessKey) = LOWER(:key)', { key: trimmedKey })
        .getOne();

      if (inactiveUserCaseInsensitive) {
        throw new ForbiddenError('Account is inactive');
      }
    } else {
      throw new ForbiddenError('Account is inactive');
    }

    throw new ValidationError('Authentication failed', undefined, {
      code: 'INVALID_KEY',
      status: 401,
    });
  }

  const shop = await ensureUserHasShop(ds, user);

  const session = {
    userId: String(user.id),
    shopId: String(shop.id),
    telegramId: String(user.telegramId ?? ''),
  };

  const now = new Date();
  const isTrialExpired = user.trialEndsAt ? new Date(user.trialEndsAt) < now : false;
  let hasActiveSubscription = false;

  if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt) {
    hasActiveSubscription = new Date(user.subscriptionEndsAt) > now;
  } else if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
    hasActiveSubscription = new Date(user.trialEndsAt) > now;
  }

  const hasAccess = user.role === 'admin' || (user.isActive && hasActiveSubscription);

  const signedSession = createSignedSession(session);

  return {
    user: userToLoginJson(user),
    session,
    subscriptionStatus: {
      hasActiveSubscription,
      isTrialExpired,
      canAccess: hasAccess,
    },
    signedSession,
  };
}
