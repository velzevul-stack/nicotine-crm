import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity } from '@/lib/db/entities';

/**
 * Middleware для проверки авторизации пользователя
 */
export async function requireAuth(ctx: Context, dataSource: DataSource): Promise<UserEntity | null> {
  const telegramId = String(ctx.from?.id);
  if (!telegramId) {
    return null;
  }

  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });
  
  return user;
}

/**
 * Middleware для проверки роли продавца
 */
export async function requireSeller(ctx: Context, dataSource: DataSource): Promise<UserEntity | null> {
  const user = await requireAuth(ctx, dataSource);
  if (!user || user.role !== 'seller') {
    return null;
  }
  return user;
}
