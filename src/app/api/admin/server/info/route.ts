import { NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { SystemSettingsEntity, UserEntity } from '@/lib/db/entities';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MoreThanOrEqual } from 'typeorm';

const MAINTENANCE_KEY = 'maintenance_mode';

/**
 * GET /api/admin/server/info - Получить информацию о сервере
 */
export async function GET() {
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
    const startTime = process.uptime();

    // Объединяем все запросы к БД в одну транзакцию для предотвращения параллельных запросов
    const result = await ds.transaction(async (em) => {
      // Проверка подключения к БД
      let dbConnected = false;
      try {
        await em.query('SELECT 1');
        dbConnected = true;
      } catch {
        dbConnected = false;
      }

      // Получаем режим обслуживания
      const settingsRepo = em.getRepository(SystemSettingsEntity);
      const maintenanceSetting = await settingsRepo.findOne({
        where: { key: MAINTENANCE_KEY },
      });

      let maintenanceMode = false;
      let maintenanceMessage = null;
      if (maintenanceSetting) {
        const value = JSON.parse(maintenanceSetting.value);
        maintenanceMode = value.enabled || false;
        maintenanceMessage = value.message || null;
      }

      // Количество активных пользователей за последний час
      const userRepo = em.getRepository(UserEntity);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const activeUsersCount = await userRepo.count({
        where: {
          updatedAt: MoreThanOrEqual(oneHourAgo),
        },
      });

      return { dbConnected, maintenanceMode, maintenanceMessage, activeUsersCount };
    });

    // Версия приложения из package.json
    let appVersion = 'unknown';
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      appVersion = packageJson.version || 'unknown';
    } catch {
      // Игнорируем ошибку чтения package.json
    }

    // Время работы сервера
    const uptimeSeconds = Math.floor(startTime);
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeFormatted = `${uptimeHours}ч ${uptimeMinutes}м`;

    return NextResponse.json({
      version: appVersion,
      uptime: uptimeFormatted,
      uptimeSeconds,
      dbConnected: result.dbConnected,
      maintenanceMode: result.maintenanceMode,
      maintenanceMessage: result.maintenanceMessage,
      activeUsersLastHour: result.activeUsersCount,
      nodeEnv: process.env.NODE_ENV || 'unknown',
    });
  } catch (error: any) {
    console.error('Error getting server info:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to get server info' },
      { status: 500 }
    );
  }
}
