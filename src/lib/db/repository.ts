import { getDataSource } from './data-source';
import type { Repository } from 'typeorm';

export async function getRepo<T extends object>(entity: string): Promise<Repository<T>> {
  const ds = await getDataSource();
  return ds.getRepository(entity) as Repository<T>;
}
