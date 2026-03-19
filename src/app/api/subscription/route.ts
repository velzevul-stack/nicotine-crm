import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { UserEntity } from '@/lib/db/entities/User';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  // Получаем текущего пользователя
  const user = await userRepo.findOne({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  // Находим всех рефералов этого пользователя
  const referrals = await userRepo.find({
    where: { referrerId: user.id },
  });

  // Подсчитываем статистику
  const now = new Date();
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > now
  ).length;

  return NextResponse.json({
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    subscriptionEndsAt: user.subscriptionEndsAt,
    referralCode: user.referralCode,
    referralsCount: referrals.length,
    activeReferralsCount: activeSubscriptions,
  });
}
