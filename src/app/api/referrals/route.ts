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
    order: { createdAt: 'DESC' },
  });

  // Подсчитываем статистику
  const now = new Date();
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > now
  ).length;

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
  const referralLink = user.referralCode 
    ? `https://t.me/${botUsername}?start=${user.referralCode}`
    : null;

  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink,
    totalReferrals: referrals.length,
    activeSubscriptions,
    referrals: referrals.map((ref) => ({
      id: ref.id,
      firstName: ref.firstName,
      lastName: ref.lastName,
      username: ref.username,
      subscriptionStatus: ref.subscriptionStatus,
      subscriptionEndsAt: ref.subscriptionEndsAt,
      createdAt: ref.createdAt,
    })),
  });
}
