import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { UserEntity, CryptoPaymentEntity } from '@/lib/db/entities';
import { createInvoice, SUBSCRIPTION_PRICE_USD } from '@/lib/nowpayments';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { id: session.userId } });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  const now = new Date();
  const isActive = user.subscriptionStatus === 'active' &&
    user.subscriptionEndsAt &&
    new Date(user.subscriptionEndsAt) > now;

  if (isActive) {
    return NextResponse.json({ message: 'Subscription already active' }, { status: 400 });
  }

  const orderId = `sub_${user.id}_${randomUUID().slice(0, 8)}`;
  const baseUrl = process.env.TELEGRAM_MINI_APP_URL || 'https://localhost:3000';

  try {
    const invoice = await createInvoice({
      priceAmount: SUBSCRIPTION_PRICE_USD,
      priceCurrency: 'usd',
      orderId,
      orderDescription: `Post Stock Pro — PRO подписка 1 мес. (${user.firstName || user.username || user.telegramId})`,
      ipnCallbackUrl: `${baseUrl}/api/payments/nowpayments/ipn`,
      successUrl: `${baseUrl}/`,
      cancelUrl: `${baseUrl}/`,
    });

    const paymentRepo = ds.getRepository(CryptoPaymentEntity);
    await paymentRepo.save({
      userId: user.id,
      invoiceId: String(invoice.id),
      orderId,
      priceAmount: SUBSCRIPTION_PRICE_USD,
      priceCurrency: 'usd',
      invoiceUrl: invoice.invoice_url,
      status: 'pending',
      subscriptionMonths: 1,
    });

    return NextResponse.json({
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      orderId,
    });
  } catch (error) {
    console.error('[NowPayments] Create invoice error:', error);
    return NextResponse.json(
      { message: 'Failed to create payment invoice' },
      { status: 500 }
    );
  }
}
