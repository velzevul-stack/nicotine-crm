import { getDataSource } from '@/lib/db/data-source';
import { ClientErrorLogEntity } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';

export async function adminListClientErrors(
  adminUserId: string,
  params: { limit: number; offset: number },
) {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();
  const [rows, total] = await ds.getRepository(ClientErrorLogEntity).findAndCount({
    order: { createdAt: 'DESC' },
    take: params.limit,
    skip: params.offset,
  });

  return { rows, total, limit: params.limit, offset: params.offset };
}
