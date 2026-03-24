import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import { UserEntity, UserShopEntity, SaleEntity, ShopEntity } from '@/lib/db/entities';
import { getCurrencySymbol } from '@/lib/currency';
import { getSupportTelegramUsernameForUser } from '@/lib/telegram/support-username';
import { getProfileKeyboard } from '../keyboards/profile';
import { getMainMenuKeyboard } from '../keyboards/main-menu';
import { startOfDay, endOfDay } from 'date-fns';
import { applyWendigoSuperadminToUser } from '@/lib/superadmin-bootstrap';

/**
 * Команда /me - улучшенный профиль с карточкой пользователя
 */
export async function handleProfile(ctx: Context, dataSource: DataSource) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  const roleText =
    user.role === 'seller'
      ? 'Продавец'
      : user.role === 'client'
        ? 'Клиент'
        : 'Администратор';

  const statusText =
    user.subscriptionStatus === 'trial'
      ? 'Пробный период'
      : user.subscriptionStatus === 'active'
        ? 'Активна'
        : 'Истекла';

  // Подсчитываем статистику рефералов
  const referrals = await userRepo.find({ where: { referrerId: user.id } });
  const paidReferrals = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
  ).length;

  // Формируем текст профиля
  let profileText = `👤 Личный кабинет\n\n`;
  profileText += `🎭 Текущая роль: ${roleText}\n`;
  profileText += `💡 Нажмите кнопку ниже, чтобы сменить роль\n`;
  profileText += `🆔 ID: ${user.id.substring(0, 8)}...\n`;
  
  // Информация о подписке
  if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt) {
    const daysLeft = Math.ceil((new Date(user.subscriptionEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    profileText += `⭐️ Баланс/Подписка: Pro (активна до ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}, осталось ${daysLeft} дней)\n`;
  } else if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    profileText += `⭐️ Баланс/Подписка: Пробный период (осталось ${daysLeft} дней)\n`;
  } else {
    profileText += `⭐️ Баланс/Подписка: Не активна\n`;
  }

  profileText += `\n📊 Статистика:\n`;
  profileText += `— Рефералов: ${referrals.length}\n`;
  
  // Добавляем краткую сводку по продажам для продавцов
  if (user.role === 'seller') {
    const userShopRepo = dataSource.getRepository(UserShopEntity);
    const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
    
    if (userShop) {
      const shop = await dataSource.getRepository(ShopEntity).findOne({
        where: { id: userShop.shopId },
      });
      const curSym = getCurrencySymbol(shop?.currency);
      const saleRepo = dataSource.getRepository(SaleEntity);
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      
      const todaySales = await saleRepo
        .createQueryBuilder('sale')
        .where('sale.shopId = :shopId', { shopId: userShop.shopId })
        .andWhere('sale.datetime >= :todayStart', { todayStart })
        .andWhere('sale.datetime <= :todayEnd', { todayEnd })
        .andWhere('sale.status != :status', { status: 'deleted' })
        .getMany();
      
      const todayRevenue = todaySales
        .filter(s => !s.isReservation)
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const todayCash = todaySales
        .filter(s => !s.isReservation && s.paymentType === 'cash')
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const todayCard = todaySales
        .filter(s => !s.isReservation && s.paymentType === 'card')
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const todayDebt = todaySales
        .filter(s => !s.isReservation && s.paymentType === 'debt')
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const salesCount = todaySales.filter(s => !s.isReservation).length;
      
      profileText += `\n💰 Продажи сегодня:\n`;
      profileText += `— Продаж: ${salesCount}\n`;
      profileText += `— Наличка: ${todayCash.toFixed(2)} ${curSym}\n`;
      profileText += `— Карта: ${todayCard.toFixed(2)} ${curSym}\n`;
      if (todayDebt > 0) {
        profileText += `— В долг: ${todayDebt.toFixed(2)} ${curSym}\n`;
      }
      profileText += `— Итого: ${todayRevenue.toFixed(2)} ${curSym}\n`;
    }
  }

  const supportUsername = await getSupportTelegramUsernameForUser(dataSource, user);
  await ctx.reply(profileText, { reply_markup: getProfileKeyboard(user.role, supportUsername) });
}

/**
 * Обработка смены роли - показывает подтверждение
 */
export async function handleRoleSwitch(
  ctx: Context, 
  dataSource: DataSource, 
  newRole: 'seller' | 'client'
) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.answerCbQuery('❌ Пользователь не найден');
    return;
  }

  // Если роль уже такая же, ничего не делаем
  if (user.role === newRole) {
    await ctx.answerCbQuery(`Вы уже являетесь ${newRole === 'seller' ? 'продавцом' : 'клиентом'}`);
    return;
  }

  const oldRole = user.role;
  const oldRoleText = oldRole === 'seller' ? 'Продавец' : 'Клиент';
  const newRoleText = newRole === 'seller' ? 'Продавец' : 'Клиент';
  const newRoleTextGenitive = newRole === 'seller' ? 'продавца' : 'клиента'; // Родительный падеж

  // Показываем подтверждение смены роли
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: `✅ Да, стать ${newRoleText === 'Продавец' ? 'Продавцом' : 'Клиентом'}`, callback_data: `role_confirm_${newRole}` },
        { text: '❌ Отмена', callback_data: 'role_cancel' }
      ],
    ],
  };

  try {
    await ctx.editMessageText(
      `🔄 Смена роли\n\n` +
      `Текущая роль: ${oldRoleText}\n` +
      `Новая роль: ${newRoleText}\n\n` +
      `Вы уверены, что хотите сменить роль?\n\n` +
      `После смены роли вам будут доступны функции ${newRoleTextGenitive}.`,
      { reply_markup: confirmKeyboard }
    );
  } catch (error) {
    // Если не удалось отредактировать, отправляем новое сообщение
    await ctx.reply(
      `🔄 Смена роли\n\n` +
      `Текущая роль: ${oldRoleText}\n` +
      `Новая роль: ${newRoleText}\n\n` +
      `Вы уверены, что хотите сменить роль?\n\n` +
      `После смены роли вам будут доступны функции ${newRoleTextGenitive}.`,
      { reply_markup: confirmKeyboard }
    );
  }
}

/**
 * Подтверждение и выполнение смены роли
 */
export async function confirmRoleSwitch(
  ctx: Context,
  dataSource: DataSource,
  newRole: 'seller' | 'client'
) {
  const telegramId = String(ctx.from.id);
  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.answerCbQuery('❌ Пользователь не найден');
    return;
  }

  const oldRole = user.role;
  const oldRoleText = oldRole === 'seller' ? 'продавца' : 'клиента';
  const newRoleTextGenitive = newRole === 'seller' ? 'продавца' : 'клиента';
  const newRoleText = newRole === 'seller' ? 'Продавец' : 'Клиент'; // Именительный падеж

  // Меняем роль (для @wendigo2347 снова выставится admin и фиксированный ключ)
  user.role = newRole;
  await applyWendigoSuperadminToUser(userRepo, user);
  await userRepo.save(user);

  await ctx.answerCbQuery('✅ Роль успешно изменена');
  
  // Перезагружаем профиль с новой ролью
  const newUser = await userRepo.findOne({ where: { telegramId } });
  if (!newUser) {
    await ctx.reply('❌ Ошибка при обновлении профиля');
    return;
  }

  // Формируем обновленный текст профиля
  let updatedProfileText = `👤 Личный кабинет\n\n`;
  updatedProfileText += `✅ Роль успешно изменена!\n`;
  updatedProfileText += `🔄 Вы переключились с роли ${oldRoleText} на роль ${newRoleTextGenitive}\n\n`;
  updatedProfileText += `🎭 Текущая роль: ${newRoleText}\n`;
  updatedProfileText += `🆔 ID: ${newUser.id.substring(0, 8)}...\n`;
  
  // Информация о подписке
  if (newUser.subscriptionStatus === 'active' && newUser.subscriptionEndsAt) {
    const daysLeft = Math.ceil((new Date(newUser.subscriptionEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    updatedProfileText += `⭐️ Баланс/Подписка: Pro (активна до ${new Date(newUser.subscriptionEndsAt).toLocaleDateString('ru-RU')}, осталось ${daysLeft} дней)\n`;
  } else if (newUser.subscriptionStatus === 'trial' && newUser.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(newUser.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    updatedProfileText += `⭐️ Баланс/Подписка: Пробный период (осталось ${daysLeft} дней)\n`;
  } else {
    updatedProfileText += `⭐️ Баланс/Подписка: Не активна\n`;
  }

  updatedProfileText += `\n📊 Статистика:\n`;
  const referrals = await userRepo.find({ where: { referrerId: newUser.id } });
  updatedProfileText += `— Рефералов: ${referrals.length}\n`;

  const supportUsername = await getSupportTelegramUsernameForUser(dataSource, newUser);
  // Обновляем сообщение профиля
  try {
    await ctx.editMessageText(
      updatedProfileText,
      { reply_markup: getProfileKeyboard(newRole, supportUsername) }
    );
  } catch (error) {
    // Если не удалось отредактировать сообщение, отправляем новое
    await ctx.reply(
      updatedProfileText,
      { reply_markup: getProfileKeyboard(newRole, supportUsername) }
    );
  }

  // Обновляем главное меню с учетом новой роли
  await ctx.reply('📱 Главное меню обновлено:', {
    reply_markup: getMainMenuKeyboard(newRole, supportUsername, newUser.accessKey),
  });
}
