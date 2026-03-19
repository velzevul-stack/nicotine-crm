import { Keyboard } from 'telegraf/types';

/**
 * Главное меню (Reply Keyboard) - компактное, 2-3 ряда
 * Показывает разные кнопки в зависимости от роли пользователя
 */
export function getMainMenuKeyboard(userRole?: 'seller' | 'client' | 'admin'): Keyboard {
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

  return {
    keyboard,
    resize_keyboard: true,
    persistent: true,
  };
}
