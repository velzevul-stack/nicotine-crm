import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { listBrands } from '@/services/inventory/inventory.brand.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await listBrands({ shopId: session.shopId });
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке брендов');
  }
}
