// Скрипты (polling): dotenv должен загрузиться до первого import этого файла — см. src/scripts/load-dotenv-first.ts
import { getDataSource } from '@/lib/db/data-source';
import { SystemSettingsEntity } from '@/lib/db/entities';

export const SETTINGS_KEYS = {
  TRIAL_DAYS: 'trial_days',
  REFERRAL_REWARD_DAYS: 'referral_reward_days',
} as const;

const DEFAULTS = {
  [SETTINGS_KEYS.TRIAL_DAYS]: 7,
  [SETTINGS_KEYS.REFERRAL_REWARD_DAYS]: 14,
};

export async function getSettingValue(key: string): Promise<number> {
  const ds = await getDataSource();
  const repo = ds.getRepository(SystemSettingsEntity);
  const setting = await repo.findOne({ where: { key } });
  if (!setting) return DEFAULTS[key as keyof typeof DEFAULTS] ?? 0;
  try {
    return JSON.parse(setting.value) as number;
  } catch {
    return DEFAULTS[key as keyof typeof DEFAULTS] ?? 0;
  }
}

export async function getTrialDays(): Promise<number> {
  return getSettingValue(SETTINGS_KEYS.TRIAL_DAYS);
}

export async function getReferralRewardDays(): Promise<number> {
  return getSettingValue(SETTINGS_KEYS.REFERRAL_REWARD_DAYS);
}
