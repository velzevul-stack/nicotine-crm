import type { InlineKeyboardMarkup } from 'telegraf/types';
import { SUBSCRIPTION_PRICE_STARS } from '@/lib/nowpayments';

/**
 * Инвойс в Telegram Stars (XTR). Для Stars обязательно provider_token: '' (см. Bot API sendInvoice).
 */
export function buildStarsSubscriptionInvoice(userId: string) {
  const cancelKeyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'subscribe_cancel' }]],
  };

  return {
    title: 'Подписка PRO на 1 месяц',
    description: `Подписка на сервис Post Stock Pro (${SUBSCRIPTION_PRICE_STARS} ⭐). После покупки ваш пригласивший (если есть) получит бонус!`,
    payload: `subscription_${userId}_${Date.now()}`,
    provider_token: '',
    provider_data: JSON.stringify({ userId }),
    currency: 'XTR' as const,
    prices: [
      {
        label: `Подписка PRO на 1 месяц (${SUBSCRIPTION_PRICE_STARS} ⭐)`,
        amount: SUBSCRIPTION_PRICE_STARS,
      },
    ],
    reply_markup: cancelKeyboard,
  };
}
