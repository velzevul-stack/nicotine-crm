import { InlineKeyboardMarkup } from 'telegraf/types';
import { TELEGRAM_INFO_CHANNEL_URL } from '@/lib/telegram/info-channel';

/** Код из t.me/bot?start=CODE — в callback встраиваем только 12 hex (как в generateReferralCode). */
const REFERRAL_CODE_FOR_CALLBACK = /^[A-Fa-f0-9]{12}$/;

/**
 * Клавиатура для онбординга (выбор роли).
 * @param embedReferralCode — если передан валидный код, он попадает в callback_data (устойчиво к рестарту бота).
 */
export function getOnboardingKeyboard(embedReferralCode?: string | null): InlineKeyboardMarkup {
  const raw = embedReferralCode?.trim();
  const safe = raw && REFERRAL_CODE_FOR_CALLBACK.test(raw) ? raw.toUpperCase() : null;
  const sellerCb = safe ? `rs_${safe}` : 'role_seller';
  // const clientCb = safe ? `rc_${safe}` : 'role_client';
  const keyboard = {
    inline_keyboard: [
      [{ text: '👨‍💼 Я Продавец', callback_data: sellerCb }],
      // [{ text: '👤 Я Клиент', callback_data: clientCb }],
      [{ text: '📢 Канал с новостями', url: TELEGRAM_INFO_CHANNEL_URL }],
    ],
  };
  
  console.log('[Onboarding] Generated keyboard:', JSON.stringify(keyboard, null, 2));
  return keyboard;
}
