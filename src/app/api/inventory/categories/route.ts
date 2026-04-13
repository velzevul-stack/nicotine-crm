import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/services/inventory/inventory.categories.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await listCategories({ shopId: session.shopId });
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при загрузке категорий');
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await createCategory({ shopId: session.shopId }, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при создании категории');
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const result = await updateCategory({ shopId: session.shopId }, body);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при обновлении категории');
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ message: 'Category ID required' }, { status: 400 });
  }

  try {
    const result = await deleteCategory({ shopId: session.shopId }, id);
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err, 'Ошибка при удалении категории');
  }
}
