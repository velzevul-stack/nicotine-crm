import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, CryptoPaymentEntity, ReferralEarningEntity } from '@/lib/db/entities';
import { verifyIpnSignature, SUBSCRIPTION_PRICE_USD, type IpnPayload } from '@/lib/nowpayments';
import { getReferralRewardDays } from '@/lib/system-settings';
import { Telegraf } from 'telegraf';

const REFERRAL_PROGRAM_END = new Date('2026-07-06T23:59:59Z');
const REFERRAL_COMMISSION = 0.5;

export async function POST(request: NextRequest) {
  let body: IpnPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const signature = request.headers.get('x-nowpayments-sig');
  if (!signature) {
    console.error('[IPN] Missing signature header');
    return NextResponse.json({ message: 'Missing signature' }, { status: 400 });
  }

  if (!verifyIpnSignature(body as unknown as Record<string, unknown>, signature)) {
    console.error('[IPN] Invalid signature');
    return NextResponse.json({ message: 'Invalid signature' }, { status: 403 });
  }

  console.log('[IPN] Received valid callback:', {
    payment_id: body.payment_id,
    payment_status: body.payment_status,
    order_id: body.order_id,
    price_amount: body.price_amount,
    pay_currency: body.pay_currency,
  });

  const ds = await getDataSource();
  const paymentRepo = ds.getRepository(CryptoPaymentEntity);
  const userRepo = ds.getRepository(UserEntity);

  const payment = await paymentRepo.findOne({ where: { orderId: body.order_id } });
  if (!payment) {
    console.error('[IPN] Payment not found for order:', body.order_id);
    return NextResponse.json({ message: 'Payment not found' }, { status: 404 });
  }

  payment.status = body.payment_status as any;
  payment.nowpaymentsPaymentId = String(body.payment_id);
  payment.payAmount = body.pay_amount;
  payment.payCurrency = body.pay_currency;
  await paymentRepo.save(payment);

  if (body.payment_status !== 'finished') {
    return NextResponse.json({ ok: true });
  }

  let referrerTelegramId: string | null = null;
  let referrerEndsAt: Date | null = null;
  let referralEarningAmount = 0;

  await ds.transaction(async (em) => {
    const user = await em.getRepository(UserEntity).findOne({ where: { id: payment.userId } });
    if (!user) {
      console.error('[IPN] User not found:', payment.userId);
      return;
    }

    const now = new Date();
    let newEndsAt: Date;

    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now) {
      newEndsAt = new Date(user.subscriptionEndsAt);
      newEndsAt.setMonth(newEndsAt.getMonth() + payment.subscriptionMonths);
    } else {
      newEndsAt = new Date();
      newEndsAt.setMonth(newEndsAt.getMonth() + payment.subscriptionMonths);
    }

    user.subscriptionStatus = 'active';
    user.subscriptionEndsAt = newEndsAt;
    await em.getRepository(UserEntity).save(user);

    console.log('[IPN] Subscription activated for user:', user.id, 'until:', newEndsAt.toISOString());

    if (user.referrerId && now < REFERRAL_PROGRAM_END) {
      const referrer = await em.getRepository(UserEntity).findOne({ where: { id: user.referrerId } });
      if (referrer) {
        referralEarningAmount = SUBSCRIPTION_PRICE_USD * REFERRAL_COMMISSION;

        const currentBalance = Number(referrer.referralBalance) || 0;
        referrer.referralBalance = currentBalance + referralEarningAmount;

        const refRewardDays = await getReferralRewardDays();
        const referrerNow = new Date();
        let referrerNewEndsAt: Date;
        if (referrer.subscriptionStatus === 'active' && referrer.subscriptionEndsAt && new Date(referrer.subscriptionEndsAt) > referrerNow) {
          referrerNewEndsAt = new Date(referrer.subscriptionEndsAt);
          referrerNewEndsAt.setDate(referrerNewEndsAt.getDate() + refRewardDays);
        } else {
          referrerNewEndsAt = new Date();
          referrerNewEndsAt.setDate(referrerNewEndsAt.getDate() + refRewardDays);
        }

        referrer.subscriptionStatus = 'active';
        referrer.subscriptionEndsAt = referrerNewEndsAt;
        await em.getRepository(UserEntity).save(referrer);

        await em.getRepository(ReferralEarningEntity).save({
          referrerId: referrer.id,
          referralId: user.id,
          amount: referralEarningAmount,
          currency: 'usd',
          source: 'crypto',
          paymentId: payment.id,
        });

        referrerTelegramId = referrer.telegramId;
        referrerEndsAt = referrerNewEndsAt;

        console.log('[IPN] Referral reward: $', referralEarningAmount, 'to', referrer.id);
      }
    }
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    try {
      const bot = new Telegraf(botToken);
      const user = await userRepo.findOne({ where: { id: payment.userId } });

      if (user) {
        await bot.telegram.sendMessage(
          parseInt(user.telegramId),
          `✅ Оплата криптой прошла успешно!\n\n` +
          `Подписка PRO активирована.\n` +
          `Валюта оплаты: ${body.pay_currency?.toUpperCase() || 'Crypto'}\n\n` +
          `Используйте /me для просмотра информации о профиле.`
        );
      }

      if (referrerTelegramId && referrerEndsAt) {
        await bot.telegram.sendMessage(
          parseInt(referrerTelegramId),
          `🎉 Поздравляем!\n\n` +
          `Ваш реферал оплатил подписку криптой!\n\n` +
          `💰 Вам начислено: $${referralEarningAmount.toFixed(2)} на реферальный баланс\n` +
          `📅 + 2 недели бесплатной подписки (до ${new Date(referrerEndsAt).toLocaleDateString('ru-RU')})\n\n` +
          `Используйте /referrals для просмотра баланса.`
        );
      }
    } catch (error) {
      console.error('[IPN] Error sending Telegram notification:', error);
    }
  }

  return NextResponse.json({ ok: true });
}
