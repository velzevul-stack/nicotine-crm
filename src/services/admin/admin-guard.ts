import { checkUserSubscription, type UserWithSubscription } from '@/lib/auth-utils';
import { ForbiddenError } from '@/services/common/domain-errors';

/** Только пользователь с ролью `admin` (по актуальным данным из БД). */
export async function requireAdminUser(userId: string): Promise<UserWithSubscription> {
  const user = await checkUserSubscription(userId);
  if (!user || user.role !== 'admin') {
    throw new ForbiddenError('Forbidden');
  }
  return user;
}
