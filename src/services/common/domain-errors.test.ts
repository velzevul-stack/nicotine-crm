import { describe, expect, it } from 'vitest';
import { AppError } from '@/services/common/app-error';
import {
  ConflictError,
  ForbiddenError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '@/services/common/domain-errors';

describe('domain errors', () => {
  it('are AppError subclasses for route handlers', () => {
    expect(new ValidationError('bad', { x: 1 })).toBeInstanceOf(AppError);
    expect(new ValidationError('x', undefined, { code: 'INVALID_BODY' }).code).toBe('INVALID_BODY');
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
    expect(new ConflictError('dup')).toBeInstanceOf(AppError);
    expect(new InsufficientStockError('no stock')).toBeInstanceOf(AppError);
  });
  it('carry codes and status', () => {
    const e = new NotFoundError('missing');
    expect(e.code).toBe('NOT_FOUND');
    expect(e.status).toBe(404);
  });
});
