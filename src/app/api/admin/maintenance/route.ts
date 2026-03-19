import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { SystemSettingsEntity } from '@/lib/db/entities';
import { z } from 'zod';

const MAINTENANCE_KEY = 'maintenance_mode';

const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().optional(),
});

/**
 * GET /api/admin/maintenance - Получить статус режима обслуживания
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
    const settingsRepo = ds.getRepository(SystemSettingsEntity);

    const setting = await settingsRepo.findOne({
      where: { key: MAINTENANCE_KEY },
    });

    if (!setting) {
      return NextResponse.json({
        enabled: false,
        message: null,
      });
    }

    const value = JSON.parse(setting.value);
    return NextResponse.json({
      enabled: value.enabled || false,
      message: value.message || null,
    });
  } catch (error: any) {
    console.error('Error getting maintenance mode:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to get maintenance mode' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/maintenance - Включить/выключить режим обслуживания
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = maintenanceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid body', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ds = await getDataSource();
    const settingsRepo = ds.getRepository(SystemSettingsEntity);

    let setting = await settingsRepo.findOne({
      where: { key: MAINTENANCE_KEY },
    });

    const value = {
      enabled: parsed.data.enabled,
      message: parsed.data.message || null,
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

    return NextResponse.json({
      success: true,
      enabled: parsed.data.enabled,
      message: parsed.data.message || null,
    });
  } catch (error: any) {
    console.error('Error setting maintenance mode:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to set maintenance mode' },
      { status: 500 }
    );
  }
}
