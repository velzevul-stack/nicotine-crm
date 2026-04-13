import { randomUUID } from 'crypto';
import { getDataSource } from '@/lib/db/data-source';
import { CryptoPaymentEntity, UserEntity } from '@/lib/db/entities';
import { createInvoice, SUBSCRIPTION_PRICE_USD } from '@/lib/nowpayments';
import { AppError } from '@/services/common/app-error';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';

export type CreateInvoiceContext = { userId: string };

export async function createSubscriptionNowpaymentsInvoice(context: CreateInvoiceContext) {
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { id: context.userId } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const now = new Date();
  const isActive =
    user.subscriptionStatus === 'active' &&
    user.subscriptionEndsAt &&
    new Date(user.subscriptionEndsAt) > now;

  if (isActive) {
    throw new ValidationError('Subscription already active', undefined, {
      code: 'SUBSCRIPTION_ACTIVE',
    });
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
    const row = paymentRepo.create({
      userId: user.id,
      invoiceId: String(invoice.id),
      orderId,
      priceAmount: SUBSCRIPTION_PRICE_USD,
      priceCurrency: 'usd',
      invoiceUrl: invoice.invoice_url,
      status: 'pending' as const,
      subscriptionMonths: 1,
    });
    await paymentRepo.save(row);

    return {
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      orderId,
    };
  } catch (error) {
    console.error('[NowPayments] Create invoice error:', error);
    throw new AppError(
      'NOWPAYMENTS',
      'Failed to create payment invoice',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
