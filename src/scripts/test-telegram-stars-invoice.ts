/**
 * Проверка sendInvoice для Telegram Stars (XTR).
 * Не храните токен в коде — только в переменных окружения.
 *
 * Запуск:
 *   TELEGRAM_BOT_TOKEN="..." TELEGRAM_TEST_CHAT_ID="123456789" npx tsx src/scripts/test-telegram-stars-invoice.ts
 *
 * TELEGRAM_TEST_CHAT_ID — ваш числовой Telegram user id (напишите @userinfobot).
 * После проверки при утечке токена перевыпустите его в @BotFather.
 */
import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_TEST_CHAT_ID;

async function main() {
  if (!token || !chatId) {
    console.error('Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_TEST_CHAT_ID');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${token}/sendInvoice`;
  const body = {
    chat_id: Number(chatId),
    title: 'Тест Stars',
    description: 'Тестовый счёт на 1 ⭐ (можно не оплачивать — проверка API)',
    payload: `test_stars_${Date.now()}`,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Тест 1 звезда', amount: 1 }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
  if (!json.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
