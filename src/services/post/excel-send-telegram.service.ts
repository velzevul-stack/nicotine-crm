import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Session } from '@/lib/session-token';
import {
  isTelegramUserNumericId,
  sendTelegramDocument,
} from '@/lib/telegram/send-document';
import { AppError } from '@/services/common/app-error';
import { ValidationError } from '@/services/common/domain-errors';
import { buildStockExcelBuffer } from '@/services/post/stock-excel.service';

const NO_NUMERIC_TG_MESSAGE =
  'Отправка в Telegram недоступна: у аккаунта нет числового Telegram ID. Откройте приложение из Telegram или войдите через бота (не только по ключу с сайта).';

export type ExcelSendTelegramBody = {
  includeBrandPhotos?: boolean;
};

export async function sendStockExcelToTelegram(
  session: Session,
  body: unknown,
): Promise<{ success: true }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new AppError('CONFIG', 'Telegram bot not configured', 500);
  }

  if (!isTelegramUserNumericId(session.telegramId)) {
    throw new ValidationError(NO_NUMERIC_TG_MESSAGE, undefined, { code: 'NO_TELEGRAM_ID', status: 400 });
  }

  const obj = body && typeof body === 'object' ? (body as ExcelSendTelegramBody) : {};
  const includeBrandPhotos = obj.includeBrandPhotos !== false;

  const buffer = await buildStockExcelBuffer(session.shopId, { includeBrandPhotos });

  const outputPath = path.join(os.tmpdir(), `stock-table-send-${session.shopId}-${Date.now()}.xlsx`);
  try {
    fs.writeFileSync(outputPath, buffer);

    const sendResult = await sendTelegramDocument({
      botToken,
      chatId: session.telegramId.trim(),
      filePath: outputPath,
      filename: 'table.xlsx',
    });

    if (!sendResult.ok) {
      console.error('Telegram sendDocument error:', {
        description: sendResult.description,
        errorCode: sendResult.errorCode,
        chatId: session.telegramId,
      });
      throw new AppError(
        'TELEGRAM_SEND',
        sendResult.description || 'Не удалось отправить файл в Telegram',
        502,
      );
    }

    return { success: true };
  } finally {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}
