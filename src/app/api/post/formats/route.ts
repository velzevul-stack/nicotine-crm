import { NextRequest, NextResponse } from 'next/server';
import { IsNull, type FindOptionsWhere } from 'typeorm';
import { getDataSource } from '@/lib/db/data-source';
import { PostFormatEntity, PostFormat } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const ds = await getDataSource();
    const formatRepo = ds.getRepository(PostFormatEntity);

    // Get global formats (shopId is null) and shop-specific formats
    const whereConditions: FindOptionsWhere<PostFormat>[] = [
      { isActive: true, shopId: IsNull() },
    ];
    if (session.shopId) {
      whereConditions.push({ isActive: true, shopId: session.shopId });
    }

    const formats = await formatRepo.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });

    return NextResponse.json({ formats });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[GET /api/post/formats] Error:', err.message, err.stack);
    return NextResponse.json(
      { message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, template, config, shopId } = body;

    if (!name || !template) {
      return NextResponse.json(
        { message: 'Name and template are required' },
        { status: 400 }
      );
    }

    const ds = await getDataSource();
    const formatRepo = ds.getRepository(PostFormatEntity);

    // Only allow creating shop-specific formats (not global)
    // Global formats should be created by admins
    const format = formatRepo.create({
      name,
      template,
      config: config || null,
      shopId: shopId || session.shopId,
      createdBy: session.userId,
      isActive: true,
    });

    await formatRepo.save(format);

    return NextResponse.json({ format }, { status: 201 });
  } catch (error) {
    console.error('Error creating post format:', error);
    return NextResponse.json(
      { message: 'Failed to create format' },
      { status: 500 }
    );
  }
}
