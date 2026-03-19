import { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Клавиатура для реферальной программы
 */
export function getReferralsKeyboard(referralLink: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ 
        text: '📤 Поделиться ссылкой', 
        switch_inline_query: `Присоединяйся к Post Stock Pro! ${referralLink}` 
      }],
      [{ text: '📋 Копировать ссылку', callback_data: 'referrals_copy_link' }],
      [{ text: '🔙 Назад', callback_data: 'profile_back' }],
    ],
  };
}
