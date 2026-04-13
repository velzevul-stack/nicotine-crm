import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, type User } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';

export async function adminListReferralsByReferrer(
  adminUserId: string,
  referrerUserId: string,
): Promise<{ referrals: User[] }> {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const referrals = await userRepo.find({
    where: { referrerId: referrerUserId },
    order: { createdAt: 'DESC' },
  });

  return { referrals };
}
