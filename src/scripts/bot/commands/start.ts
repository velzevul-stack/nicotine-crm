import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity } from '@/lib/db/entities';
import { getSupportTelegramUsernameForUser } from '@/lib/telegram/support-username';
import { getOnboardingKeyboard } from '../keyboards/onboarding';
import { getMainMenuKeyboard } from '../keyboards/main-menu';
import { applyWendigoSuperadminToUser } from '@/lib/superadmin-bootstrap';
import { infoChannelMessageFooter } from '@/lib/telegram/info-channel';

/**
 * Команда /start - улучшенный онбординг с баннером
 */
export async function handleStart(ctx: Context, dataSource: DataSource) {
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const lastName = ctx.from.last_name || null;
  
  // Получаем реферальный код из start_param
  const startParam = ctx.message && 'text' in ctx.message 
    ? ctx.message.text.split(' ').slice(1)[0] 
    : undefined;

  const userRepo = dataSource.getRepository(UserEntity);
  let user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    // Новый пользователь - показываем онбординг с баннером
    let referrerId: string | null = null;
    if (startParam) {
      const referrer = await userRepo.findOne({ where: { referralCode: startParam } });
      if (referrer && String(referrer.telegramId) !== telegramId) {
        referrerId = referrer.id;
      }
    }

    // Сохраняем состояние с реферальным кодом (временное хранилище)
    // В реальной реализации лучше использовать сессии
    const referralMessage = referrerId 
      ? '\n\n🎁 Вы перешли по реферальной ссылке! При покупке подписки ваш пригласивший получит бесплатный месяц.'
      : '';

    // Отправляем приветственное сообщение
    // Примечание: Для баннера нужно будет добавить изображение
    // Пока отправляем текстовое сообщение, но структура готова для добавления фото
    const welcomeText = `👋 Добро пожаловать в Post Stock Pro!

Это ваш личный ассистент для управления продажами и покупками.

🚀 Для продавцов: Создавайте красивые посты, управляйте наличием и форматами в пару кликов.
🛍 Для клиентов: Следите за любимыми магазинами и актуальным наличием.

👇 Чтобы начать, выберите, как вы хотите использовать бота:${referralMessage}

*Роль можно сменить в любой момент в профиле*${infoChannelMessageFooter()}`;

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      ...getOnboardingKeyboard(referrerId ? startParam : null),
    });

    // Реферальный код будет сохранен в главном файле через roleSelectionState
    
    return;
  }

  let needUserSave = false;
  if (username !== null && username !== undefined && user.username !== username) {
    user.username = username;
    needUserSave = true;
  }
  if (await applyWendigoSuperadminToUser(userRepo, user)) needUserSave = true;
  if (needUserSave) await userRepo.save(user);

  // Существующий пользователь - показываем приветствие и меню
  const trialInfo = user.trialEndsAt
    ? `\nПробный период до: ${new Date(user.trialEndsAt).toLocaleDateString('ru-RU')}`
    : '';
  const subscriptionInfo =
    user.subscriptionStatus === 'active' && user.subscriptionEndsAt
      ? `\nПодписка активна до: ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}`
      : user.subscriptionStatus === 'expired'
        ? '\n⚠️ Подписка истекла'
        : '';

  const roleText = user.role === 'seller' 
    ? 'Продавец' 
    : user.role === 'client' 
      ? 'Клиент' 
      : 'Администратор';

  const supportUsername = await getSupportTelegramUsernameForUser(dataSource, user);

  await ctx.reply(
    `Привет, ${firstName || 'пользователь'}! 👋\n\n` +
      `Ваша роль: ${roleText}\n` +
      `Статус подписки: ${user.subscriptionStatus === 'trial' ? 'Пробный период' : user.subscriptionStatus === 'active' ? 'Активна' : 'Истекла'}` +
      trialInfo +
      subscriptionInfo +
      infoChannelMessageFooter(),
    { reply_markup: getMainMenuKeyboard(user.role, supportUsername, user.accessKey) }
  );
}
