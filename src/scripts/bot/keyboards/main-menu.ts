import { Keyboard } from 'telegraf/types';
import { TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT } from '@/lib/telegram/support-username';

/**
 * Главное меню (Reply Keyboard) - компактное, 2-3 ряда
 * Показывает разные кнопки в зависимости от роли пользователя
 */
export function getMainMenuKeyboard(
  userRole?: 'seller' | 'client' | 'admin',
  supportTelegramUsername?: string | null
): Keyboard {
  const keyboard: any[][] = [
    [{ text: '🌐 Открыть приложение', web_app: { url: process.env.TELEGRAM_MINI_APP_URL || 'https://127.0.0.1:8443' } }],
  ];

  // Для продавцов показываем кнопку "Пост"
  if (userRole === 'seller' || !userRole) {
    keyboard.push([{ text: '📝 Пост' }, { text: '👤 Профиль' }]);
  } else {
    // Для клиентов показываем только профиль
    keyboard.push([{ text: '👤 Профиль' }]);
  }

  keyboard.push([{ text: '💳 Подписка' }, { text: '🎁 Рефералы' }]);

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
