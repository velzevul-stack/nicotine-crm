import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { getDataSource } from '@/lib/db/data-source';
import { SystemSettingsEntity } from '@/lib/db/entities';
import { SETTINGS_KEYS, getClientErrorLoggingEnabled } from '@/lib/system-settings';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(SystemSettingsEntity);

  const trialSetting = await repo.findOne({ where: { key: SETTINGS_KEYS.TRIAL_DAYS } });
  const referralSetting = await repo.findOne({ where: { key: SETTINGS_KEYS.REFERRAL_REWARD_DAYS } });
  const clientErrorLoggingEnabled = await getClientErrorLoggingEnabled();

  return NextResponse.json({
    trialDays: trialSetting ? JSON.parse(trialSetting.value) : 7,
    referralRewardDays: referralSetting ? JSON.parse(referralSetting.value) : 14,
    clientErrorLoggingEnabled,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const ds = await getDataSource();
  const repo = ds.getRepository(SystemSettingsEntity);

  if (typeof body.trialDays === 'number' && body.trialDays >= 1 && body.trialDays <= 90) {
    let setting = await repo.findOne({ where: { key: SETTINGS_KEYS.TRIAL_DAYS } });
    if (setting) {
      setting.value = JSON.stringify(body.trialDays);
      await repo.save(setting);
    } else {
      await repo.save(repo.create({
        key: SETTINGS_KEYS.TRIAL_DAYS,
        value: JSON.stringify(body.trialDays),
        description: 'Длительность пробного периода (дней)',
      }));
    }
  }

  if (typeof body.referralRewardDays === 'number' && body.referralRewardDays >= 1 && body.referralRewardDays <= 90) {
    let setting = await repo.findOne({ where: { key: SETTINGS_KEYS.REFERRAL_REWARD_DAYS } });
    if (setting) {
      setting.value = JSON.stringify(body.referralRewardDays);
      await repo.save(setting);
    } else {
      await repo.save(repo.create({
        key: SETTINGS_KEYS.REFERRAL_REWARD_DAYS,
        value: JSON.stringify(body.referralRewardDays),
        description: 'Бонус за реферала (дней подписки)',
      }));
    }
  }

  if (typeof body.clientErrorLoggingEnabled === 'boolean') {
    let setting = await repo.findOne({ where: { key: SETTINGS_KEYS.CLIENT_ERROR_LOGGING_ENABLED } });
    const val = JSON.stringify(body.clientErrorLoggingEnabled);
    if (setting) {
      setting.value = val;
      await repo.save(setting);
    } else {
      await repo.save(
        repo.create({
          key: SETTINGS_KEYS.CLIENT_ERROR_LOGGING_ENABLED,
          value: val,
          description: 'Сохранять на сервер короткие логи ошибок с сайта (клиенты)',
        })
      );
    }
  }

  const trialSetting = await repo.findOne({ where: { key: SETTINGS_KEYS.TRIAL_DAYS } });
  const referralSetting = await repo.findOne({ where: { key: SETTINGS_KEYS.REFERRAL_REWARD_DAYS } });
  const clientErrorLoggingEnabled = await getClientErrorLoggingEnabled();

  return NextResponse.json({
    trialDays: trialSetting ? JSON.parse(trialSetting.value) : 7,
    referralRewardDays: referralSetting ? JSON.parse(referralSetting.value) : 14,
    clientErrorLoggingEnabled,
  });
}
