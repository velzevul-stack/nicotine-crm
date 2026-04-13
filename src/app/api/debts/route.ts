import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { listDebtsWithOperations, recordDebtPayment } from '@/services/debts/debts.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const withOps = await listDebtsWithOperations({ shopId: session.shopId });
    return NextResponse.json(withOps);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке долгов');
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await recordDebtPayment({ shopId: session.shopId }, body);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при погашении долга');
  }
}
