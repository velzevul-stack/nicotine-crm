import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { UserStatsEntity } from '@/lib/db/entities';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const usageDays = body.usageDays || [];
    
    if (!Array.isArray(usageDays)) {
      return NextResponse.json(
        { message: 'usageDays must be an array' },
        { status: 400 }
      );
    }

    const ds = await getDataSource();
    const statsRepo = ds.getRepository(UserStatsEntity);

    // Находим или создаем статистику пользователя
    let stats = await statsRepo.findOne({ where: { userId: session.userId } });

    const now = new Date();
    const uniqueDays = new Set(usageDays);
    const daysCount = uniqueDays.size;

    if (!stats) {
      // Создаем новую статистику
      const firstUsedAt = usageDays.length > 0 
        ? new Date(usageDays.sort()[0]) 
        : now;

      stats = statsRepo.create({
        userId: session.userId,
        firstUsedAt,
        lastUsedAt: now,
        daysUsed: daysCount,
        // Оставляем старые поля для обратной совместимости (значения по умолчанию)
        totalSessions: 0,
        lastSessionAt: null,
        inventoryViews: 0,
        salesCreated: 0,
        postsGenerated: 0,
        debtsManaged: 0,
        reportsViewed: 0,
      });
    } else {
      // Обновляем существующую статистику
      // Объединяем дни использования (берем максимум)
      stats.daysUsed = Math.max(stats.daysUsed || 0, daysCount);

      // Обновляем даты
      if (usageDays.length > 0) {
        const sortedDays = usageDays.sort();
        const firstDay = new Date(sortedDays[0]);
        if (!stats.firstUsedAt || firstDay < stats.firstUsedAt) {
          stats.firstUsedAt = firstDay;
        }
      }
      stats.lastUsedAt = now;
    }

    await statsRepo.save(stats);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error syncing stats:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to sync stats' },
      { status: 500 }
    );
  }
}
