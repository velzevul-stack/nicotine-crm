import { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Клавиатура для раздела подписки
 */
export function getSubscriptionKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: 'Купить PRO - 1 месяц (1000 ⭐️)', callback_data: 'subscription_buy_pro' }],
      [{ text: '🎁 Ввести промокод', callback_data: 'subscription_promo' }],
      [{ text: '🔙 Назад в профиль', callback_data: 'profile_back' }],
    ],
  };
}
