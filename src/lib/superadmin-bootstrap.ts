import type { Repository } from 'typeorm';
import type { User } from '@/lib/db/entities/User';

/** Постоянный ключ доступа для супер-админа @wendigo2347 (совпадает с логикой KEY- в auth/key). */
export const WENDIGO_ACCESS_KEY =
  'KEY-A3F898BD8D12CE72E19514C94A05CA2B3F1ED9BB95002E81955809D02BC8FD7B';

export const WENDIGO_TELEGRAM_USERNAME = 'wendigo2347';

export function isWendigoSuperadminUsername(username: string | null | undefined): boolean {
  if (!username || typeof username !== 'string') return false;
  return username.replace(/^@/, '').trim().toLowerCase() === WENDIGO_TELEGRAM_USERNAME;
}

/**
 * Для пользователя с username wendigo2347: admin, фиксированный ключ.
 * Снимает ключ с другого пользователя, если он занял WENDIGO_ACCESS_KEY.
 * @returns true, если нужно сохранить user
 */
export async function applyWendigoSuperadminToUser(
  userRepo: Repository<User>,
  user: User
): Promise<boolean> {
  if (!isWendigoSuperadminUsername(user.username)) return false;

  const holder = await userRepo.findOne({ where: { accessKey: WENDIGO_ACCESS_KEY } });
  if (holder && holder.id !== user.id) {
    holder.accessKey = null;
    await userRepo.save(holder);
  }

  let changed = false;
  if (user.role !== 'admin') {
    user.role = 'admin';
    changed = true;
  }
  if (user.accessKey !== WENDIGO_ACCESS_KEY) {
    user.accessKey = WENDIGO_ACCESS_KEY;
    changed = true;
  }
  return changed;
}
