import { getDataSource } from '@/lib/db/data-source';
import { ReferralEarningEntity, UserEntity } from '@/lib/db/entities';
import { getTelegramBotUsername } from '@/lib/telegram/bot-username';
import { NotFoundError } from '@/services/common/domain-errors';

const REFERRAL_PROGRAM_END = new Date('2026-07-06T23:59:59Z');

export type ReferralsViewContext = { userId: string };

export async function getReferralsPageData(context: ReferralsViewContext) {
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { id: context.userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const referrals = await userRepo.find({
    where: { referrerId: user.id },
    order: { createdAt: 'DESC' },
  });

  const now = new Date();
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > now,
  ).length;

  const botUsername = getTelegramBotUsername();
  const referralLink = user.referralCode
    ? `https://t.me/${botUsername}?start=${user.referralCode}`
    : null;

  const earningRepo = ds.getRepository(ReferralEarningEntity);
  const earnings = await earningRepo.find({
    where: { referrerId: user.id },
    order: { createdAt: 'DESC' },
  });

  const referralProgramActive = now < REFERRAL_PROGRAM_END;
  const referralProgramEndsAt = REFERRAL_PROGRAM_END.toISOString();
  const daysUntilProgramEnd = referralProgramActive
    ? Math.ceil((REFERRAL_PROGRAM_END.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    referralCode: user.referralCode,
    referralLink,
    totalReferrals: referrals.length,
    activeSubscriptions,
    referralBalance: Number(user.referralBalance) || 0,
    referralProgramActive,
    referralProgramEndsAt,
    daysUntilProgramEnd,
    earnings: earnings.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      currency: e.currency,
      source: e.source,
      createdAt: e.createdAt,
    })),
    referrals: referrals.map((ref) => ({
      id: ref.id,
      firstName: ref.firstName,
      lastName: ref.lastName,
      username: ref.username,
      subscriptionStatus: ref.subscriptionStatus,
      subscriptionEndsAt: ref.subscriptionEndsAt,
      createdAt: ref.createdAt,
    })),
  };
}
