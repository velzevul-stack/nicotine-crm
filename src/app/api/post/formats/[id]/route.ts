import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  deletePostFormat,
  getPostFormatById,
  updatePostFormat,
} from '@/services/post/post-formats.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const format = await getPostFormatById(session, id);
    return NextResponse.json({ format });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const format = await updatePostFormat(session, id, body);
    return NextResponse.json({ format });
  } catch (e) {
    console.error('Error updating post format:', e);
    return serviceErrorResponse(e, 'Failed to update format');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deletePostFormat(session, id);
    return NextResponse.json({ message: 'Format deleted' });
  } catch (e) {
    console.error('Error deleting post format:', e);
    return serviceErrorResponse(e, 'Failed to delete format');
  }
}
