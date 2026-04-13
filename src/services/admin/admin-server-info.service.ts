import { readFileSync } from 'fs';
import { join } from 'path';
import { getDataSource } from '@/lib/db/data-source';
import { SystemSettingsEntity, UserEntity } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';
import { MoreThanOrEqual } from 'typeorm';

const MAINTENANCE_KEY = 'maintenance_mode';

export type AdminServerInfoPayload = {
  version: string;
  uptime: string;
  uptimeSeconds: number;
  dbConnected: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  activeUsersLastHour: number;
  nodeEnv: string;
};

export async function adminGetServerInfo(adminUserId: string): Promise<AdminServerInfoPayload> {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();
  const startTime = process.uptime();

  const result = await ds.transaction(async (em) => {
    let dbConnected = false;
    try {
      await em.query('SELECT 1');
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const settingsRepo = em.getRepository(SystemSettingsEntity);
    const maintenanceSetting = await settingsRepo.findOne({
      where: { key: MAINTENANCE_KEY },
    });

    let maintenanceMode = false;
    let maintenanceMessage: string | null = null;
    if (maintenanceSetting) {
      try {
        const value = JSON.parse(maintenanceSetting.value) as {
          enabled?: boolean;
          message?: string | null;
        };
        maintenanceMode = Boolean(value.enabled);
        maintenanceMessage = value.message ?? null;
      } catch {
        maintenanceMode = false;
        maintenanceMessage = null;
      }
    }

    const userRepo = em.getRepository(UserEntity);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeUsersCount = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(oneHourAgo),
      },
    });

    return { dbConnected, maintenanceMode, maintenanceMessage, activeUsersCount };
  });

  let appVersion = 'unknown';
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
    appVersion = packageJson.version || 'unknown';
  } catch {
    // ignore
  }

  const uptimeSeconds = Math.floor(startTime);
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeFormatted = `${uptimeHours}ч ${uptimeMinutes}м`;

  return {
    version: appVersion,
    uptime: uptimeFormatted,
    uptimeSeconds,
    dbConnected: result.dbConnected,
    maintenanceMode: result.maintenanceMode,
    maintenanceMessage: result.maintenanceMessage,
    activeUsersLastHour: result.activeUsersCount,
    nodeEnv: process.env.NODE_ENV || 'unknown',
  };
}
