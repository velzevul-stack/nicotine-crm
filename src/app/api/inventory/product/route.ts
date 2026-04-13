import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import { createProduct } from '@/services/inventory/inventory.product.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await createProduct({ shopId: session.shopId }, body);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при создании товара');
  }
}
