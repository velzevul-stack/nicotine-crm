export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new AppError('INTERNAL_ERROR', error.message || fallbackMessage, 500);
  }
  return new AppError('INTERNAL_ERROR', fallbackMessage, 500);
}

/** Stable JSON shape for API error responses (omit `errors` when there are no details). */
export function appErrorResponseBody(err: AppError): { message: string; errors?: unknown } {
  return err.details !== undefined
    ? { message: err.message, errors: err.details }
    : { message: err.message };
}
