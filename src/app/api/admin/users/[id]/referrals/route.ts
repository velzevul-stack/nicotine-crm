import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const referrals = await userRepo.find({
    where: { referrerId: id },
    order: { createdAt: 'DESC' },
  });

  return NextResponse.json({ referrals });
}
