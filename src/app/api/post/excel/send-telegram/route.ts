import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { sendStockExcelToTelegram } from '@/services/post/excel-send-telegram.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  try {
    const result = await sendStockExcelToTelegram(session, body);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Excel send-telegram error:', err);
    return serviceErrorResponse(err, 'Failed to send Excel to Telegram');
  }
}
