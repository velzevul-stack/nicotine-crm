import { InlineKeyboardMarkup } from 'telegraf/types';
import { SUBSCRIPTION_PRICE_USD, SUBSCRIPTION_PRICE_STARS } from '@/lib/nowpayments';

/**
 * Клавиатура для раздела подписки
 */
export function getSubscriptionKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: `⭐ Купить PRO — 1 мес. (${SUBSCRIPTION_PRICE_STARS} ⭐️)`, callback_data: 'subscription_buy_stars' }],
      [{ text: `₿ Оплатить криптой — $${SUBSCRIPTION_PRICE_USD}`, callback_data: 'subscription_buy_crypto' }],
      [{ text: '🎁 Ввести промокод', callback_data: 'subscription_promo' }],
      [{ text: '🔙 Назад в профиль', callback_data: 'profile_back' }],
    ],
  };
}
