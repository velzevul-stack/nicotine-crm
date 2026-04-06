import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity } from '@/lib/db/entities';
import { getSubscriptionKeyboard } from '../keyboards/subscription';
import { buildStarsSubscriptionInvoice } from '@/lib/telegram/stars-subscription-invoice';

/**
 * Команда /subscribe - красивое меню подписки с описанием тарифов
 */
export async function handleSubscription(ctx: Context, dataSource: DataSource) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  const now = new Date();
  const isActive = user.subscriptionStatus === 'active' && 
                   user.subscriptionEndsAt && 
                   new Date(user.subscriptionEndsAt) > now;

  let subscriptionText = `💎 Тарифные планы Post Stock Pro\n\n`;
  subscriptionText += `На данный момент доступен единый тариф PRO, открывающий все возможности сервиса.\n\n`;
  subscriptionText += `Что входит в PRO:\n`;
  subscriptionText += `✅ Неограниченное создание форматов постов\n`;
  subscriptionText += `✅ Доступ к веб-версии без ограничений\n`;
  subscriptionText += `✅ Приоритетная поддержка\n`;
  subscriptionText += `✅ Участие в реферальной программе\n\n`;
  
  subscriptionText += `📅 Ваша подписка:\n`;
  if (isActive && user.subscriptionEndsAt) {
    const daysLeft = Math.ceil((new Date(user.subscriptionEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    subscriptionText += `Статус: Активна (осталось ${daysLeft} дней)\n`;
    subscriptionText += `Действует до: ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}`;
  } else if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    subscriptionText += `Статус: Пробный период (осталось ${daysLeft} дней)\n`;
    subscriptionText += `Действует до: ${new Date(user.trialEndsAt).toLocaleDateString('ru-RU')}`;
  } else {
    subscriptionText += `Статус: Не активна`;
  }

  subscriptionText += `\n\nВыберите способ оплаты:`;
  await ctx.reply(subscriptionText, { reply_markup: getSubscriptionKeyboard() });
}

/**
 * Обработка покупки подписки
 */
export async function handleBuySubscription(ctx: Context, dataSource: DataSource) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.answerCbQuery('❌ Пользователь не найден');
    return;
  }

  // Проверяем текущий статус подписки
  const now = new Date();
  const isActive = user.subscriptionStatus === 'active' && 
                   user.subscriptionEndsAt && 
                   new Date(user.subscriptionEndsAt) > now;
  
  if (isActive) {
    await ctx.answerCbQuery('✅ У вас уже есть активная подписка!');
    return;
  }

  await ctx.answerCbQuery();
  try {
    await ctx.replyWithInvoice(buildStarsSubscriptionInvoice(user.id));
  } catch (error) {
    console.error('Error sending invoice:', error);
    await ctx.reply('❌ Ошибка при создании счёта. Попробуйте позже или оплатите криптой.');
  }
}
