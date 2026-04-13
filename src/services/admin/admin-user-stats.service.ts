import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, UserStatsEntity } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';
import { In } from 'typeorm';

export async function adminListUserStats(adminUserId: string) {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();

  const result = await ds.transaction(async (em) => {
    const statsRepo = em.getRepository(UserStatsEntity);
    const userRepo = em.getRepository(UserEntity);

    const allStats = await statsRepo.find({
      order: { lastUsedAt: 'DESC' },
    });

    const userIds = allStats.map((s) => s.userId);
    const users =
      userIds.length > 0 ? await userRepo.find({ where: { id: In(userIds) } }) : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return allStats.map((stat) => {
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
  });

  return { stats: result };
}
