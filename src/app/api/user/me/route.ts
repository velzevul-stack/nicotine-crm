import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: userWithSub.id,
    telegramId: userWithSub.telegramId,
    firstName: userWithSub.firstName,
    lastName: userWithSub.lastName,
    username: userWithSub.username,
    role: userWithSub.role,
    subscriptionStatus: userWithSub.subscriptionStatus,
  });
}
