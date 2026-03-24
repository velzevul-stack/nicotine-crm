/** Публичный канал: новости и информация по боту */
export const TELEGRAM_INFO_CHANNEL_URL = 'https://t.me/+o0GXxOax4104NjIy';

export const TELEGRAM_INFO_CHANNEL_INTRO = 'Вся информация по боту и обновлениям здесь:';

/** Текст reply-кнопки в главном меню (должен совпадать во всех обработчиках message.text) */
export const TELEGRAM_INFO_CHANNEL_REPLY_BUTTON = '📢 Канал';

export function infoChannelMessageFooter(): string {
  return `\n\n${TELEGRAM_INFO_CHANNEL_INTRO}\n${TELEGRAM_INFO_CHANNEL_URL}`;
}
