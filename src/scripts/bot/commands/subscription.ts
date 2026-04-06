import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity } from '@/lib/db/entities';
import { getSubscriptionKeyboard } from '../keyboards/subscription';
import { SUBSCRIPTION_PRICE_STARS } from '@/lib/nowpayments';

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

  await ctx.reply(subscriptionText, getSubscriptionKeyboard());
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

  const subscriptionPriceStars = SUBSCRIPTION_PRICE_STARS;

  try {
    await ctx.replyWithInvoice({
      title: 'Подписка PRO на 1 месяц',
      description: `Подписка на сервис Post Stock Pro (${subscriptionPriceStars} ⭐). После покупки ваш пригласивший (если есть) получит бонус!`,
      payload: `subscription_${user.id}_${Date.now()}`,
      provider_data: JSON.stringify({ userId: user.id }),
      currency: 'XTR', // Telegram Stars
      prices: [{ label: `Подписка PRO на 1 месяц (${subscriptionPriceStars} ⭐)`, amount: subscriptionPriceStars }],
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Отмена', callback_data: 'subscribe_cancel' }],
        ],
      },
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    await ctx.answerCbQuery('❌ Ошибка при создании счёта. Попробуйте позже.');
  }
}
