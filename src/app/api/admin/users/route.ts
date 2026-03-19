import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { In } from 'typeorm';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';

  let query = userRepo.createQueryBuilder('user');

  if (search) {
    query = query.where(
      '(user.username ILIKE :search OR user.firstName ILIKE :search OR user.telegramId = :exactSearch)',
      { search: `%${search}%`, exactSearch: search }
    );
  }

  const users = await query.orderBy('user.createdAt', 'DESC').getMany();

  if (users.length === 0) {
    return NextResponse.json({ users: [] });
  }

  // Оптимизация: получаем все рефералы одним запросом
  const userIds = users.map((u) => u.id);
  const referrerIds = users.filter((u) => u.referrerId).map((u) => u.referrerId!);
  const allReferrerIds = [...new Set([...userIds, ...referrerIds])];

  // Получаем всех рефералов для всех пользователей одним запросом
  const allReferrals = allReferrerIds.length > 0
    ? await userRepo.find({
        where: { referrerId: In(allReferrerIds) },
      })
    : [];

  // Получаем информацию о реферерах одним запросом
  const referrers = referrerIds.length > 0
    ? await userRepo.find({
        where: { id: In(referrerIds) },
      })
    : [];

  // Создаем мапы для быстрого доступа
  const referralsByReferrerId = new Map<string, typeof allReferrals>();
  for (const referral of allReferrals) {
    if (referral.referrerId) {
      const list = referralsByReferrerId.get(referral.referrerId) || [];
      list.push(referral);
      referralsByReferrerId.set(referral.referrerId, list);
    }
  }

  const referrerInfoMap = new Map<string, typeof referrers[0]>();
  for (const referrer of referrers) {
    referrerInfoMap.set(referrer.id, referrer);
  }

  // Подсчитываем статистику для каждого пользователя
  const now = new Date();
  const usersWithReferrals = users.map((user) => {
    const referrals = referralsByReferrerId.get(user.id) || [];
    const activeSubscriptions = referrals.filter(
      (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > now
    ).length;

    let referrerInfo = null;
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
      referralsCount: referrals.length,
      activeReferralsCount: activeSubscriptions,
      referrerInfo,
    };
  });

  return NextResponse.json({ users: usersWithReferrals });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { userId, updates } = await request.json();

  if (!userId || !updates) {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  // Обновляем разрешенные поля
  if (updates.role && ['admin', 'seller', 'client'].includes(updates.role)) {
    user.role = updates.role;
  }
  if (updates.subscriptionStatus && ['trial', 'active', 'expired'].includes(updates.subscriptionStatus)) {
    user.subscriptionStatus = updates.subscriptionStatus;
  }
  if (updates.trialEndsAt !== undefined) {
    user.trialEndsAt = updates.trialEndsAt ? new Date(updates.trialEndsAt) : null;
  }
  if (updates.subscriptionEndsAt !== undefined) {
    user.subscriptionEndsAt = updates.subscriptionEndsAt ? new Date(updates.subscriptionEndsAt) : null;
  }
  if (typeof updates.isActive === 'boolean') {
    user.isActive = updates.isActive;
  }

  await userRepo.save(user);

  return NextResponse.json({ success: true, user });
}
