import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, type User } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import { In } from 'typeorm';

export type AdminUserListRow = User & {
  referralBalance: number;
  referralsCount: number;
  activeReferralsCount: number;
  referrerInfo: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    referralCode: string | null;
  } | null;
};

export async function adminSearchUsers(
  adminUserId: string,
  search: string,
): Promise<{ users: AdminUserListRow[] }> {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  let query = userRepo.createQueryBuilder('user');

  if (search) {
    query = query.where(
      '(user.username ILIKE :search OR user.firstName ILIKE :search OR user.telegramId = :exactSearch)',
      { search: `%${search}%`, exactSearch: search },
    );
  }

  const users = await query.orderBy('user.createdAt', 'DESC').getMany();

  if (users.length === 0) {
    return { users: [] };
  }

  const userIds = users.map((u) => u.id);
  const referrerIds = users.filter((u) => u.referrerId).map((u) => u.referrerId!);
  const allReferrerIds = [...new Set([...userIds, ...referrerIds])];

  const allReferrals =
    allReferrerIds.length > 0
      ? await userRepo.find({
          where: { referrerId: In(allReferrerIds) },
        })
      : [];

  const referrers =
    referrerIds.length > 0
      ? await userRepo.find({
          where: { id: In(referrerIds) },
        })
      : [];

  const referralsByReferrerId = new Map<string, User[]>();
  for (const referral of allReferrals) {
    if (referral.referrerId) {
      const list = referralsByReferrerId.get(referral.referrerId) || [];
      list.push(referral);
      referralsByReferrerId.set(referral.referrerId, list);
    }
  }

  const referrerInfoMap = new Map<string, User>();
  for (const referrer of referrers) {
    referrerInfoMap.set(referrer.id, referrer);
  }

  const now = new Date();
  const usersWithReferrals: AdminUserListRow[] = users.map((user) => {
    const referrals = referralsByReferrerId.get(user.id) || [];
    const activeSubscriptions = referrals.filter(
      (r) =>
        r.subscriptionStatus === 'active' &&
        r.subscriptionEndsAt &&
        new Date(r.subscriptionEndsAt) > now,
    ).length;

    let referrerInfo: AdminUserListRow['referrerInfo'] = null;
    if (user.referrerId) {
      const referrer = referrerInfoMap.get(user.referrerId);
      if (referrer) {
        referrerInfo = {
          id: referrer.id,
          firstName: referrer.firstName,
          lastName: referrer.lastName,
          username: referrer.username,
          referralCode: referrer.referralCode,
        };
      }
    }

    return {
      ...user,
      referralBalance: Number(user.referralBalance) || 0,
      referralsCount: referrals.length,
      activeReferralsCount: activeSubscriptions,
      referrerInfo,
    };
  });

  return { users: usersWithReferrals };
}

export async function adminPatchUser(
  adminUserId: string,
  body: { userId?: string; updates?: Record<string, unknown> },
): Promise<{ user: User }> {
  await requireAdminUser(adminUserId);

  const { userId, updates } = body;
  if (!userId || !updates) {
    throw new ValidationError('Invalid body');
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (updates.role && ['admin', 'seller', 'client'].includes(String(updates.role))) {
    user.role = updates.role as User['role'];
  }
  if (
    updates.subscriptionStatus &&
    ['trial', 'active', 'expired'].includes(String(updates.subscriptionStatus))
  ) {
    user.subscriptionStatus = updates.subscriptionStatus as User['subscriptionStatus'];
  }
  if (updates.trialEndsAt !== undefined) {
    user.trialEndsAt = updates.trialEndsAt ? new Date(String(updates.trialEndsAt)) : null;
  }
  if (updates.subscriptionEndsAt !== undefined) {
    user.subscriptionEndsAt = updates.subscriptionEndsAt
      ? new Date(String(updates.subscriptionEndsAt))
      : null;
  }
  if (typeof updates.isActive === 'boolean') {
    user.isActive = updates.isActive;
  }
  if (typeof updates.referralBalance === 'number') {
    user.referralBalance = updates.referralBalance;
  }

  await userRepo.save(user);
  return { user };
}

export async function adminDeleteUser(
  adminUserId: string,
  targetUserId: string,
): Promise<void> {
  await requireAdminUser(adminUserId);

  if (!targetUserId) {
    throw new ValidationError('userId required');
  }

  if (targetUserId === adminUserId) {
    throw new ValidationError('Cannot delete yourself');
  }

  const ds = await getDataSource();

  await ds.transaction(async (em) => {
    await em.query(
      'DELETE FROM sale_items WHERE "saleId" IN (SELECT id FROM sales WHERE "sellerId" = $1)',
      [targetUserId],
    );
    await em.query('DELETE FROM sales WHERE "sellerId" = $1', [targetUserId]);
    await em.query(
      'DELETE FROM debt_operations WHERE "debtId" IN (SELECT id FROM debts WHERE "shopId" IN (SELECT "shopId" FROM user_shops WHERE "userId" = $1))',
      [targetUserId],
    );
    await em.query(
      'DELETE FROM debts WHERE "shopId" IN (SELECT "shopId" FROM user_shops WHERE "userId" = $1)',
      [targetUserId],
    );
    await em.query('DELETE FROM user_stats WHERE "userId" = $1', [targetUserId]);
    await em.query('DELETE FROM user_shops WHERE "userId" = $1', [targetUserId]);
    await em.query('DELETE FROM referral_earnings WHERE "referrerId" = $1 OR "referralId" = $1', [
      targetUserId,
    ]);
    await em.query('DELETE FROM crypto_payments WHERE "userId" = $1', [targetUserId]);
    await em.query('UPDATE users SET "referrerId" = NULL WHERE "referrerId" = $1', [targetUserId]);
    await em.query('DELETE FROM users WHERE id = $1', [targetUserId]);
  });
}
