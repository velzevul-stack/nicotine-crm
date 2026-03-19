import { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Клавиатура для профиля пользователя
 * Кнопка смены роли вынесена отдельно для лучшей видимости
 * @param supportTelegramUsername - юзернейм из админки (с @ или без), для кнопки поддержки
 */
export function getProfileKeyboard(
  userRole: 'seller' | 'client' | 'admin',
  supportTelegramUsername?: string | null
): InlineKeyboardMarkup {
  const supportUsername = supportTelegramUsername?.replace('@', '').trim();
  const supportButton = supportUsername
    ? [{ text: 'Поддержка', url: `https://t.me/${supportUsername}` }]
    : [];

  // Определяем текст и callback для смены роли - делаем более понятным и коротким
  const switchRoleText = userRole === 'seller'
    ? '👤 Стать Клиентом'
    : '🏪 Стать Продавцом';
  const switchRoleCallback = userRole === 'seller' ? 'profile_switch_to_client' : 'profile_switch_to_seller';

  // Для админов не показываем кнопку смены роли
  if (userRole === 'admin') {
    return {
      inline_keyboard: [
        ...(supportButton.length ? [supportButton] : []),
        [{ text: '💎 Управление подпиской', callback_data: 'profile_subscription' }],
        [{ text: '🎁 Реферальная программа', callback_data: 'profile_referrals' }],
        [{ text: '🔑 Мой ключ доступа', callback_data: 'profile_access_key' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_menu' }],
      ],
    };
  }

  // Для клиентов показываем только смену роли, ключ и назад
  if (userRole === 'client') {
    return {
      inline_keyboard: [
        ...(supportButton.length ? [supportButton] : []),
        [{ text: switchRoleText, callback_data: switchRoleCallback }],
        [{ text: '🔑 Мой ключ доступа', callback_data: 'profile_access_key' }],
        [{ text: '🔙 Назад в меню', callback_data: 'back_to_menu' }],
      ],
    };
  }

  // Для продавцов показываем все функции
  return {
    inline_keyboard: [
      ...(supportButton.length ? [supportButton] : []),
      [{ text: switchRoleText, callback_data: switchRoleCallback }],
      [{ text: '💎 Управление подпиской', callback_data: 'profile_subscription' }],
      [{ text: '🎁 Реферальная программа', callback_data: 'profile_referrals' }],
      [{ text: '🔑 Мой ключ доступа', callback_data: 'profile_access_key' }],
      [{ text: '🔙 Назад в меню', callback_data: 'back_to_menu' }],
    ],
  };
}
