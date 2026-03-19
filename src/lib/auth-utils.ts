import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';

export interface UserWithSubscription extends UserEntity {
  hasActiveSubscription: boolean;
  isTrialExpired: boolean;
}

/**
 * Проверяет, активна ли подписка у пользователя
 */
export async function checkUserSubscription(userId: string): Promise<UserWithSubscription | null> {
  const ds = await getDataSource();
  
  // Используем транзакцию для предотвращения параллельных запросов на одном соединении
  return ds.transaction(async (em) => {
    const userRepo = em.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return null;

    const now = new Date();
    const isTrialExpired = user.trialEndsAt ? new Date(user.trialEndsAt) < now : false;
    
    let hasActiveSubscription = false;
    
    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt) {
      hasActiveSubscription = new Date(user.subscriptionEndsAt) > now;
    } else if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
      hasActiveSubscription = new Date(user.trialEndsAt) > now;
    }

    return {
      ...user,
      hasActiveSubscription,
      isTrialExpired,
    };
  });
}

/**
 * Проверяет, может ли пользователь получить доступ к функционалу
 */
export function canAccess(user: UserWithSubscription | null): boolean {
  if (!user) return false;
  if (!user.isActive) return false;
  
  // Админы всегда имеют доступ
  if (user.role === 'admin') return true;
  
  // Проверяем подписку
  return user.hasActiveSubscription;
}
