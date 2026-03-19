/**
 * Telegram Bot API: chat_id для личного чата — числовой id (строка из цифр).
 * Для входа по ключу без реального Telegram в сессии может быть пусто или dev-user-1.
 */
export function isPlausibleTelegramChatId(telegramId: string | null | undefined): boolean {
  if (telegramId == null || telegramId === '') return false;
  // Личные чаты: положительное целое. Группы/каналы часто отрицательные — тоже только цифры и минус.
  return /^-?\d{5,}$/.test(String(telegramId).trim());
}
