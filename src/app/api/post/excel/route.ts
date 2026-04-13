import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { buildStockExcelBuffer } from '@/services/post/stock-excel.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const includeBrandPhotos = body.includeBrandPhotos !== false;

  try {
    const buffer = await buildStockExcelBuffer(session.shopId, { includeBrandPhotos });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="table.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Excel generation error:', err);
    return serviceErrorResponse(err, 'Excel generation failed');
  }
}
