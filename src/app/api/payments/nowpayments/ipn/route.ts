import { NextRequest, NextResponse } from 'next/server';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import type { IpnPayload } from '@/lib/nowpayments';
import { processNowpaymentsIpn } from '@/services/payments/nowpayments-ipn.service';

export async function POST(request: NextRequest) {
  let body: IpnPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const signature = request.headers.get('x-nowpayments-sig');

  try {
    await processNowpaymentsIpn(body, signature);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, 'IPN processing failed');
  }
}
