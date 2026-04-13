import { getDataSource } from '@/lib/db/data-source';
import { UserStatsEntity } from '@/lib/db/entities';
import { ValidationError } from '@/services/common/domain-errors';
import { syncUserStatsBodySchema } from '@/services/stats/user-stats-sync.validators';

export type UserStatsSyncContext = { userId: string };

export async function syncUserUsageStats(context: UserStatsSyncContext, body: unknown) {
  const parsed = syncUserStatsBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const usageDays = parsed.data.usageDays;

  const ds = await getDataSource();
  const statsRepo = ds.getRepository(UserStatsEntity);

  let stats = await statsRepo.findOne({ where: { userId: context.userId } });

  const now = new Date();
  const uniqueDays = new Set(usageDays);
  const daysCount = uniqueDays.size;

  if (!stats) {
    const firstUsedAt = usageDays.length > 0 ? new Date([...usageDays].sort()[0]!) : now;

    stats = statsRepo.create({
      userId: context.userId,
      firstUsedAt,
      lastUsedAt: now,
      daysUsed: daysCount,
      totalSessions: 0,
      lastSessionAt: null,
      inventoryViews: 0,
      salesCreated: 0,
      postsGenerated: 0,
      debtsManaged: 0,
      reportsViewed: 0,
    });
  } else {
    stats.daysUsed = Math.max(stats.daysUsed || 0, daysCount);

    if (usageDays.length > 0) {
      const sortedDays = [...usageDays].sort();
      const firstDay = new Date(sortedDays[0]!);
      if (!stats.firstUsedAt || firstDay < stats.firstUsedAt) {
        stats.firstUsedAt = firstDay;
      }
    }
    stats.lastUsedAt = now;
  }

  await statsRepo.save(stats);
  return { success: true as const };
}
