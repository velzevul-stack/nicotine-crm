import crypto from 'crypto';

const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';

function getApiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error('NOWPAYMENTS_API_KEY is not set');
  return key;
}

function getIpnSecret(): string {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) throw new Error('NOWPAYMENTS_IPN_SECRET is not set');
  return secret;
}

export interface CreateInvoiceParams {
  priceAmount: number;
  priceCurrency?: string;
  orderId: string;
  orderDescription?: string;
  ipnCallbackUrl: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface InvoiceResponse {
  id: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  invoice_url: string;
  success_url: string;
  cancel_url: string;
  created_at: string;
  updated_at: string;
}

export interface IpnPayload {
  payment_id: number;
  invoice_id: number;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: number;
  outcome_amount: number;
  outcome_currency: string;
  [key: string]: unknown;
}

export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
  const response = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency || 'usd',
      order_id: params.orderId,
      order_description: params.orderDescription || 'Post Stock Pro Subscription',
      ipn_callback_url: params.ipnCallbackUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[NowPayments] Create invoice error:', response.status, errorBody);
    throw new Error(`NowPayments API error: ${response.status}`);
  }

  return response.json();
}

export function verifyIpnSignature(body: Record<string, unknown>, signature: string): boolean {
  const ipnSecret = getIpnSecret();

  const sortedKeys = Object.keys(body).sort();
  const sortedBody: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedBody[key] = body[key];
  }

  const hmac = crypto.createHmac('sha512', ipnSecret);
  hmac.update(JSON.stringify(sortedBody));
  const calculatedSignature = hmac.digest('hex');

  return calculatedSignature === signature;
}

export async function getPaymentStatus(paymentId: string | number): Promise<any> {
  const response = await fetch(`${NOWPAYMENTS_API_URL}/payment/${paymentId}`, {
    headers: { 'x-api-key': getApiKey() },
  });

  if (!response.ok) {
    throw new Error(`NowPayments get payment error: ${response.status}`);
  }

  return response.json();
}

export const SUBSCRIPTION_PRICE_USD = 10;
