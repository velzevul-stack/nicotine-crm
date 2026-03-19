import { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Клавиатура для онбординга (выбор роли)
 */
export function getOnboardingKeyboard(): InlineKeyboardMarkup {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👨‍💼 Я Продавец', callback_data: 'role_seller' }],
      [{ text: '👤 Я Клиент', callback_data: 'role_client' }],
    ],
  };
  
  console.log('[Onboarding] Generated keyboard:', JSON.stringify(keyboard, null, 2));
  return keyboard;
}
