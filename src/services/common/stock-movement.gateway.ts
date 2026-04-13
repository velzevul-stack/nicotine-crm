import type { EntityManager } from 'typeorm';
import {
  logStockMovement as logStockMovementLib,
  resolveProductUiName as resolveProductUiNameLib,
} from '@/lib/stock-movement-log';

export type LogStockMovementInput = Parameters<typeof logStockMovementLib>[1];

/** Точка входа для приложения: логирование движения остатков (реализация в `lib`). */
export async function logStockMovement(em: EntityManager, input: LogStockMovementInput): Promise<void> {
  return logStockMovementLib(em, input);
}

export const resolveProductUiName = resolveProductUiNameLib;
