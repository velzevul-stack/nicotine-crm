import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';
import { Telegraf } from 'telegraf';
import { isSameDay } from 'date-fns';
import { AppError } from '@/services/common/app-error';

const LOSS_AVERSION_MESSAGE =
  `⚠️ Ваш пробный период заканчивается сегодня!\n\n` +
  `🎁 Вы использовали Post Stock Pro бесплатно в течение 14 дней.\n\n` +
  `💔 Не теряйте доступ к:\n` +
  `• 📝 Генерации красивых постов\n` +
  `• 📊 Управлению остатками\n` +
  `• 💰 Отслеживанию продаж и долгов\n` +
  `• 📈 Детальной аналитике\n\n` +
  `💳 Продолжите пользоваться всеми возможностями — от $8 в месяц!\n\n` +
  `Используйте команду /subscribe для покупки подписки.`;

export type TrialEndNotificationRunResult = {
  success: true;
  message: string;
  timestamp: string;
  results: {
    total: number;
    sent: number;
    failed: number;
    errors: string[];
  };
};

/** Рассылка в Telegram пользователям с окончанием триала сегодня (статус trial). */
export async function runTrialEndNotifications(): Promise<TrialEndNotificationRunResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new AppError('CONFIG', 'TELEGRAM_BOT_TOKEN is not set', 500);
  }

  const bot = new Telegraf(botToken);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const now = new Date();

  const usersWithExpiringTrial = await userRepo.find({
    where: { subscriptionStatus: 'trial' },
  });

  const usersToNotify = usersWithExpiringTrial.filter((user) => {
    if (!user.trialEndsAt) return false;
    return isSameDay(new Date(user.trialEndsAt), now);
  });

  console.log(
    `[Trial End Notification] Found ${usersToNotify.length} users with expiring trial today`,
  );

  const results = {
    total: usersToNotify.length,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const user of usersToNotify) {
    try {
      const telegramId = parseInt(user.telegramId, 10);

      if (Number.isNaN(telegramId)) {
        console.error(
          `[Trial End Notification] Invalid telegramId for user ${user.id}: ${user.telegramId}`,
        );
        results.failed++;
        results.errors.push(`User ${user.id}: Invalid telegramId`);
        continue;
      }

      await bot.telegram.sendMessage(telegramId, LOSS_AVERSION_MESSAGE, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Купить подписку', callback_data: 'subscription_buy_pro' }],
            [{ text: '👤 Мой профиль', callback_data: 'profile_subscription' }],
          ],
        },
      });

      console.log(
        `[Trial End Notification] Sent notification to user ${user.id} (${user.telegramId})`,
      );
      results.sent++;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Trial End Notification] Failed to send notification to user ${user.id}:`, error);
      results.failed++;
      results.errors.push(`User ${user.id}: ${msg || 'Unknown error'}`);
    }
  }

  return {
    success: true,
    message: `Processed ${usersToNotify.length} users`,
    timestamp: new Date().toISOString(),
    results,
  };
}
