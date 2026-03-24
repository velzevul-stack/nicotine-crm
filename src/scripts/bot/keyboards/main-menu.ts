import { Keyboard } from 'telegraf/types';
import { TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT } from '@/lib/telegram/support-username';
import { TELEGRAM_INFO_CHANNEL_REPLY_BUTTON } from '@/lib/telegram/info-channel';
import { getTelegramMiniAppLoginUrl, getTelegramMiniAppRootUrl } from '@/lib/telegram/mini-app-urls';

/**
 * Главное меню (Reply Keyboard) - компактное, 2-3 ряда
 * Показывает разные кнопки в зависимости от роли пользователя
 */
export function getMainMenuKeyboard(
  userRole?: 'seller' | 'client' | 'admin',
  supportTelegramUsername?: string | null,
  accessKey?: string | null
): Keyboard {
  const appUrl =
    accessKey?.trim() ? getTelegramMiniAppLoginUrl(accessKey.trim()) : getTelegramMiniAppRootUrl();
  const keyboard: any[][] = [[{ text: '🌐 Открыть приложение', web_app: { url: appUrl } }]];

  // Для продавцов показываем кнопку "Пост"
  if (userRole === 'seller' || !userRole) {
    keyboard.push([{ text: '📝 Пост' }, { text: '👤 Профиль' }]);
  } else {
    // Для клиентов показываем только профиль
    keyboard.push([{ text: '👤 Профиль' }]);
  }

  keyboard.push([{ text: '💳 Подписка' }, { text: '🎁 Рефералы' }]);

  keyboard.push([{ text: TELEGRAM_INFO_CHANNEL_REPLY_BUTTON }]);

  const supportUser = supportTelegramUsername?.replace('@', '').trim();
  if (supportUser) {
    keyboard.push([{ text: TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    persistent: true,
  };
}
