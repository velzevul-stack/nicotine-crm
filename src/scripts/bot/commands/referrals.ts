import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity } from '@/lib/db/entities';
import { getReferralsKeyboard } from '../keyboards/referrals';

/**
 * Команда /referrals - улучшенная реферальная программа
 */
export async function handleReferrals(ctx: Context, dataSource: DataSource) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  // Находим всех рефералов этого пользователя
  const referrals = await userRepo.find({ where: { referrerId: user.id } });
  
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

  // Подсчитываем статистику
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
  ).length;

  const paidReferrals = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
  ).length;

  // Подсчитываем заработанные месяцы (по количеству оплативших)
  const earnedMonths = paidReferrals;
  
  // TODO: Добавить счетчик переходов по ссылке в БД (пока используем количество рефералов как приблизительное значение)
  const linkClicks = referrals.length; // Временное значение

  let message = `🤝 Партнерская программа\n\n`;
  message += `Приглашайте коллег и друзей! За каждого, кто оформит подписку, вы получите +1 месяц бесплатно.\n\n`;
  message += `📊 Ваша статистика:\n`;
  message += `👥 Переходов по ссылке: ${linkClicks}\n`;
  message += `✅ Регистраций: ${referrals.length}\n`;
  message += `💰 Оплативших: ${paidReferrals}\n`;
  message += `🎁 Заработано месяцев: ${earnedMonths}\n\n`;
  message += `🔗 Ваша ссылка:\n${referralLink}`;

  await ctx.reply(message, getReferralsKeyboard(referralLink));
}

/**
 * Обработка копирования реферальной ссылки
 */
export async function handleCopyReferralLink(ctx: Context, dataSource: DataSource) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user || !user.referralCode) {
    await ctx.answerCbQuery('❌ Реферальный код не найден');
    return;
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

  // Отправляем сообщение с ссылкой для быстрого копирования
  await ctx.answerCbQuery('✅ Ссылка скопирована');
  await ctx.reply(
    `🔗 Ваша реферальная ссылка:\n\n${referralLink}\n\n*Нажмите на ссылку для копирования*`,
    { parse_mode: 'Markdown' }
  );
}
