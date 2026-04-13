import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';
import { NotFoundError } from '@/services/common/domain-errors';

export type SubscriptionViewContext = { userId: string };

export async function getSubscriptionSummary(context: SubscriptionViewContext) {
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { id: context.userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const referrals = await userRepo.find({
    where: { referrerId: user.id },
  });

  const now = new Date();
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > now,
  ).length;

  return {
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    subscriptionEndsAt: user.subscriptionEndsAt,
    referralCode: user.referralCode,
    referralsCount: referrals.length,
    activeReferralsCount: activeSubscriptions,
    referralBalance: Number(user.referralBalance) || 0,
  };
}
