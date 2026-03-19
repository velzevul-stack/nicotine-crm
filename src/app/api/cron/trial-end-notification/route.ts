import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';
import { Telegraf } from 'telegraf';
import { isSameDay } from 'date-fns';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set');
}

const bot = new Telegraf(botToken);

/**
 * Проверяет, что запрос пришел от авторизованного источника (Vercel Cron или с правильным секретом)
 */
function isAuthorizedRequest(request: NextRequest): boolean {
  // Проверяем заголовок от Vercel Cron (если используется Vercel)
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader) {
    return true; // Запрос от Vercel Cron
  }

  // Проверяем секретный ключ из переменных окружения
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Если CRON_SECRET не установлен, разрешаем только запросы от Vercel Cron
    console.warn('[Trial End Notification] CRON_SECRET not set, only Vercel Cron requests allowed');
    return false;
  }

  // Проверяем Authorization заголовок
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Проверяем секрет в query параметре (для совместимости с некоторыми cron сервисами)
  const url = new URL(request.url);
  const secretParam = url.searchParams.get('secret');
  if (secretParam === cronSecret) {
    return true;
  }

  return false;
}

/**
 * API route для отправки Loss Aversion уведомлений пользователям,
 * у которых заканчивается триал сегодня.
 * 
 * Защита:
 * - Автоматически разрешает запросы от Vercel Cron (заголовок x-vercel-cron)
 * - Требует CRON_SECRET для других источников (через Authorization: Bearer или ?secret=)
 * 
 * Использование:
 * - Vercel Cron: добавьте в vercel.json (автоматическая авторизация)
 * - Внешний cron сервис: используйте Authorization: Bearer <CRON_SECRET>
 *   или добавьте ?secret=<CRON_SECRET> к URL
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    if (!isAuthorizedRequest(request)) {
      console.warn('[Trial End Notification] Unauthorized request attempt', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json(
        { 
          success: false,
          message: 'Unauthorized. This endpoint requires authentication.' 
        },
        { status: 401 }
      );
    }

    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);

    // Получаем текущую дату
    const now = new Date();

    // Находим всех пользователей с истекающим триалом сегодня
    // и статусом 'trial', у которых еще нет активной подписки
    const usersWithExpiringTrial = await userRepo.find({
      where: {
        subscriptionStatus: 'trial',
      },
    });

    // Фильтруем пользователей, у которых триал заканчивается сегодня
    const usersToNotify = usersWithExpiringTrial.filter((user) => {
      if (!user.trialEndsAt) return false;
      const trialEndDate = new Date(user.trialEndsAt);
      return isSameDay(trialEndDate, now);
    });

    console.log(`[Trial End Notification] Found ${usersToNotify.length} users with expiring trial today`);

    const results = {
      total: usersToNotify.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Отправляем уведомления каждому пользователю
    for (const user of usersToNotify) {
      try {
        const telegramId = parseInt(user.telegramId, 10);
        
        if (isNaN(telegramId)) {
          console.error(`[Trial End Notification] Invalid telegramId for user ${user.id}: ${user.telegramId}`);
          results.failed++;
          results.errors.push(`User ${user.id}: Invalid telegramId`);
          continue;
        }

        // Loss Aversion сообщение
        const message = `⚠️ Ваш пробный период заканчивается сегодня!\n\n` +
          `🎁 Вы использовали Post Stock Pro бесплатно в течение 14 дней.\n\n` +
          `💔 Не теряйте доступ к:\n` +
          `• 📝 Генерации красивых постов\n` +
          `• 📊 Управлению остатками\n` +
          `• 💰 Отслеживанию продаж и долгов\n` +
          `• 📈 Детальной аналитике\n\n` +
          `💳 Продолжите пользоваться всеми возможностями всего за 1000 ⭐ (≈ $10) в месяц!\n\n` +
          `Используйте команду /subscribe для покупки подписки.`;

        await bot.telegram.sendMessage(telegramId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Купить подписку', callback_data: 'subscription_buy_pro' }],
              [{ text: '👤 Мой профиль', callback_data: 'profile_subscription' }],
            ],
          },
        });

        console.log(`[Trial End Notification] Sent notification to user ${user.id} (${user.telegramId})`);
        results.sent++;
      } catch (error: any) {
        console.error(`[Trial End Notification] Failed to send notification to user ${user.id}:`, error);
        results.failed++;
        results.errors.push(`User ${user.id}: ${error.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${usersToNotify.length} users`,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[Trial End Notification] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Также поддерживаем POST для совместимости с некоторыми cron сервисами
export async function POST(request: NextRequest) {
  return GET(request);
}
