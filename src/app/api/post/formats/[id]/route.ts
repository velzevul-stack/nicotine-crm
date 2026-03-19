import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { PostFormatEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = await formatRepo.findOne({
    where: [
      { id: params.id, shopId: null },
      { id: params.id, shopId: session.shopId },
    ],
  });

  if (!format) {
    return NextResponse.json({ message: 'Format not found' }, { status: 404 });
  }

  return NextResponse.json({ format });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, template, config, isActive } = body;

    const ds = await getDataSource();
    const formatRepo = ds.getRepository(PostFormatEntity);

    // Find format - only allow editing shop-specific formats or global formats (for admins)
    const format = await formatRepo.findOne({
      where: [
        { id: params.id, shopId: null },
        { id: params.id, shopId: session.shopId },
      ],
    });

    if (!format) {
      return NextResponse.json({ message: 'Format not found' }, { status: 404 });
    }

    // Only allow editing shop-specific formats (not global)
    if (format.shopId === null && session.role !== 'admin') {
      return NextResponse.json(
        { message: 'Cannot edit global formats' },
        { status: 403 }
      );
    }

    // Only allow editing own shop formats
    if (format.shopId !== null && format.shopId !== session.shopId) {
      return NextResponse.json(
        { message: 'Cannot edit other shop formats' },
        { status: 403 }
      );
    }

    if (name !== undefined) format.name = name;
    if (template !== undefined) format.template = template;
    if (config !== undefined) format.config = config;
    if (isActive !== undefined) format.isActive = isActive;

    await formatRepo.save(format);

    return NextResponse.json({ format });
  } catch (error) {
    console.error('Error updating post format:', error);
    return NextResponse.json(
      { message: 'Failed to update format' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ds = await getDataSource();
    const formatRepo = ds.getRepository(PostFormatEntity);

    const format = await formatRepo.findOne({
      where: [
        { id: params.id, shopId: null },
        { id: params.id, shopId: session.shopId },
      ],
    });

    if (!format) {
      return NextResponse.json({ message: 'Format not found' }, { status: 404 });
    }

    // Only allow deleting shop-specific formats (not global)
    if (format.shopId === null && session.role !== 'admin') {
      return NextResponse.json(
        { message: 'Cannot delete global formats' },
        { status: 403 }
      );
    }

    // Only allow deleting own shop formats
    if (format.shopId !== null && format.shopId !== session.shopId) {
      return NextResponse.json(
        { message: 'Cannot delete other shop formats' },
        { status: 403 }
      );
    }

    await formatRepo.remove(format);

    return NextResponse.json({ message: 'Format deleted' });
  } catch (error) {
    console.error('Error deleting post format:', error);
    return NextResponse.json(
      { message: 'Failed to delete format' },
      { status: 500 }
    );
  }
}
