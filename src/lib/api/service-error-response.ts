import { NextResponse } from 'next/server';
import { appErrorResponseBody, toAppError } from '@/services/common/app-error';

/** Единый ответ API для ошибок из сервисного слоя (`AppError` и наследники). */
export function serviceErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  const appError = toAppError(error, fallbackMessage);
  return NextResponse.json(appErrorResponseBody(appError), { status: appError.status });
}
