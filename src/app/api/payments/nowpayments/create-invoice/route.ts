import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { createSubscriptionNowpaymentsInvoice } from '@/services/payments/nowpayments-subscription-invoice.service';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await createSubscriptionNowpaymentsInvoice({ userId: session.userId });
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при создании счёта');
  }
}
