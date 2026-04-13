import { AppError } from '@/services/common/app-error';

export type ValidationErrorOptions = { code?: string; status?: number };

/** Ошибки валидации входа / бизнес-инвариантов (по умолчанию HTTP 400). */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown, options?: ValidationErrorOptions) {
    const code = options?.code ?? 'VALIDATION';
    const status = options?.status ?? 400;
    super(code, message, status, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string) {
    super('INSUFFICIENT_STOCK', message, 400);
    this.name = 'InsufficientStockError';
  }
}
