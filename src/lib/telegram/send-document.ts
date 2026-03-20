import FormData from 'form-data';
import fs from 'fs';

/** Telegram ожидает числовой chat_id (id пользователя), не строку вроде dev-user-1 */
export function isTelegramUserNumericId(id: string | undefined | null): boolean {
  if (id == null || typeof id !== 'string') return false;
  return /^\d+$/.test(id.trim());
}

export type SendTelegramDocumentResult =
  | { ok: true }
  | { ok: false; description: string; errorCode?: number };

/**
 * Отправка файла через sendDocument.
 * Использует Buffer, а не stream — совместимо с undici fetch в Node без duplex.
 */
export async function sendTelegramDocument(input: {
  botToken: string;
  chatId: string;
  filePath: string;
  filename: string;
}): Promise<SendTelegramDocumentResult> {
  const { botToken, chatId, filePath, filename } = input;
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('chat_id', chatId.trim());
  form.append('document', buffer, {
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form as unknown as BodyInit,
    headers: form.getHeaders() as HeadersInit,
  });

  const text = await res.text();
  let parsed: { ok?: boolean; description?: string; error_code?: number };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return {
      ok: false,
      description: text ? text.slice(0, 300) : `HTTP ${res.status}`,
    };
  }

  if (!parsed.ok) {
    return {
      ok: false,
      description: parsed.description || `HTTP ${res.status}`,
      errorCode: parsed.error_code,
    };
  }

  return { ok: true };
}
