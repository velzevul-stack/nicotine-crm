import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { UserStatsEntity, UserEntity } from '@/lib/db/entities';
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

  try {
    const ds = await getDataSource();
    
    // Объединяем все запросы к БД в одну транзакцию
    const result = await ds.transaction(async (em) => {
      const statsRepo = em.getRepository(UserStatsEntity);
      const userRepo = em.getRepository(UserEntity);

      const allStats = await statsRepo.find({
        order: { lastUsedAt: 'DESC' },
      });

      // Обогащаем статистику данными пользователей
      const userIds = allStats.map((s) => s.userId);
      const users = userIds.length > 0
        ? await userRepo.find({ where: { id: In(userIds) } })
        : [];

      const userMap = new Map(users.map((u) => [u.id, u]));

      const statsWithUsers = allStats.map((stat) => {
        const user = userMap.get(stat.userId);
        return {
          ...stat,
          user: user
            ? {
                id: user.id,
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                role: user.role,
                subscriptionStatus: user.subscriptionStatus,
              }
            : null,
        };
      });

      return statsWithUsers;
    });

    return NextResponse.json({ stats: result });
  } catch (error: any) {
    console.error('Error getting admin stats:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
