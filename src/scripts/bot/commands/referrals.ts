import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity } from '@/lib/db/entities';
import { getTelegramBotUsername } from '@/lib/telegram/bot-username';
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
  
  const botUsername = getTelegramBotUsername();
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

  // Подсчитываем статистику
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
  ).length;

  const paidReferrals = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
  ).length;

  const earnedMonths = paidReferrals;
  const balance = Number(user.referralBalance) || 0;

  const REFERRAL_PROGRAM_END = new Date('2026-07-06T23:59:59Z');
  const now2 = new Date();
  const programActive = now2 < REFERRAL_PROGRAM_END;
  const daysLeft = programActive
    ? Math.ceil((REFERRAL_PROGRAM_END.getTime() - now2.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  let message = `🤝 Партнерская программа\n\n`;
  message += `Приглашайте коллег и друзей!\n`;
  message += `За каждого, кто оформит подписку:\n`;
  message += `• +1 месяц бесплатной подписки\n`;
  message += `• +50% от стоимости подписки на баланс\n\n`;
  message += `📊 Ваша статистика:\n`;
  message += `👥 Регистраций: ${referrals.length}\n`;
  message += `💰 Оплативших: ${paidReferrals}\n`;
  message += `🎁 Заработано месяцев: ${earnedMonths}\n`;
  message += `💵 Баланс: $${balance.toFixed(2)}\n\n`;

  if (programActive) {
    message += `⏰ Программа действует ещё ${daysLeft} дн.\n\n`;
  } else {
    message += `⚠️ Программа завершена\n\n`;
  }

  message += `🔗 Ваша ссылка:\n${referralLink}`;

  await ctx.reply(message, { reply_markup: getReferralsKeyboard(referralLink) });
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

  const botUsername = getTelegramBotUsername();
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

  // Отправляем сообщение с ссылкой для быстрого копирования
  await ctx.answerCbQuery('✅ Ссылка скопирована');
  await ctx.reply(
    `🔗 Ваша реферальная ссылка:\n\n${referralLink}\n\n*Нажмите на ссылку для копирования*`,
    { parse_mode: 'Markdown' }
  );
}
