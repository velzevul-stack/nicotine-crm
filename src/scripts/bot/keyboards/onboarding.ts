import { InlineKeyboardMarkup } from 'telegraf/types';
import { TELEGRAM_INFO_CHANNEL_URL } from '@/lib/telegram/info-channel';

/**
 * Клавиатура для онбординга (выбор роли)
 */
export function getOnboardingKeyboard(): InlineKeyboardMarkup {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👨‍💼 Я Продавец', callback_data: 'role_seller' }],
      [{ text: '👤 Я Клиент', callback_data: 'role_client' }],
      [{ text: '📢 Канал с новостями', url: TELEGRAM_INFO_CHANNEL_URL }],
    ],
  };
  
  console.log('[Onboarding] Generated keyboard:', JSON.stringify(keyboard, null, 2));
  return keyboard;
}
