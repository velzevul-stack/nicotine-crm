import { getDataSource } from '@/lib/db/data-source';
import { SystemSettingsEntity } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';
import { ValidationError } from '@/services/common/domain-errors';
import { z } from 'zod';

const MAINTENANCE_KEY = 'maintenance_mode';

const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().optional(),
});

export type MaintenanceStatus = {
  enabled: boolean;
  message: string | null;
};

export async function adminGetMaintenance(adminUserId: string): Promise<MaintenanceStatus> {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();
  const setting = await ds.getRepository(SystemSettingsEntity).findOne({
    where: { key: MAINTENANCE_KEY },
  });

  if (!setting) {
    return { enabled: false, message: null };
  }

  try {
    const value = JSON.parse(setting.value) as { enabled?: boolean; message?: string | null };
    return {
      enabled: Boolean(value.enabled),
      message: value.message ?? null,
    };
  } catch {
    return { enabled: false, message: null };
  }
}

export async function adminSetMaintenance(
  adminUserId: string,
  body: unknown,
): Promise<MaintenanceStatus> {
  await requireAdminUser(adminUserId);

  const parsed = maintenanceSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const settingsRepo = ds.getRepository(SystemSettingsEntity);

  let setting = await settingsRepo.findOne({
    where: { key: MAINTENANCE_KEY },
  });

  const value = {
    enabled: parsed.data.enabled,
    message: parsed.data.message ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (!setting) {
    setting = settingsRepo.create({
      key: MAINTENANCE_KEY,
      value: JSON.stringify(value),
      description: 'Режим обслуживания системы',
    });
  } else {
    setting.value = JSON.stringify(value);
  }

  await settingsRepo.save(setting);

  return {
    enabled: parsed.data.enabled,
    message: parsed.data.message ?? null,
  };
}
