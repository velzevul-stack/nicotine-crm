import type { EntityManager } from 'typeorm';
import { getDataSource } from '@/lib/db/data-source';

/**
 * Единая точка входа в транзакцию TypeORM для сервисов (use-case внутри одного `EntityManager`).
 */
export async function withTransaction<T>(work: (em: EntityManager) => Promise<T>): Promise<T> {
  const ds = await getDataSource();
  return ds.transaction(work);
}
