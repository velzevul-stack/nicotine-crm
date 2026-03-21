import fs from 'fs';

/** Telegram ожидает числовой chat_id (id пользователя), не строку вроде dev-user-1 */
export function isTelegramUserNumericId(id: string | undefined | null): boolean {
  if (id == null || typeof id !== 'string') return false;
  return /^\d+$/.test(id.trim());
}

export type SendTelegramDocumentResult =
  | { ok: true }
  | { ok: false; description: string; errorCode?: number };

function resultFromTelegramBody(text: string, httpStatus: number): SendTelegramDocumentResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, description: `Пустой ответ Telegram (HTTP ${httpStatus})` };
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      ok?: boolean;
      description?: string;
      error_code?: number;
    };
    if (parsed.ok === true) {
      return { ok: true };
    }
    return {
      ok: false,
      description: parsed.description || `HTTP ${httpStatus}`,
      errorCode: parsed.error_code,
    };
  } catch {
    return {
      ok: false,
      description: trimmed.slice(0, 400) || `HTTP ${httpStatus}`,
    };
  }
}

/**
 * Отправка файла через sendDocument.
 * Встроенный FormData + Blob (Node 18+) — корректная multipart-сборка для undici fetch;
 * пакет `form-data` с fetch часто даёт HTTP 400 без нормального JSON от Telegram.
 */
export async function sendTelegramDocument(input: {
  botToken: string;
  chatId: string;
  filePath: string;
  filename: string;
}): Promise<SendTelegramDocumentResult> {
  const { botToken, chatId, filePath, filename } = input;
  const buffer = fs.readFileSync(filePath);

  if (buffer.length === 0) {
    return { ok: false, description: 'Файл пустой (0 байт)' };
  }

  const form = new FormData();
  form.append('chat_id', chatId.trim());
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('document', blob, filename);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  const text = await res.text();
  return resultFromTelegramBody(text, res.status);
}
