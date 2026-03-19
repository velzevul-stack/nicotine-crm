import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { PostFormatEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { formatId, name, template, config } = body;

    const ds = await getDataSource();
    const formatRepo = ds.getRepository(PostFormatEntity);

    // If formatId is provided, try to import from existing format
    if (formatId) {
      const sourceFormat = await formatRepo.findOne({
        where: { id: formatId },
      });

      if (!sourceFormat) {
        return NextResponse.json(
          { message: 'Source format not found' },
          { status: 404 }
        );
      }

      // Create a copy for the current shop
      const newFormat = formatRepo.create({
        name: name || `${sourceFormat.name} (Copy)`,
        template: sourceFormat.template,
        config: sourceFormat.config,
        shopId: session.shopId,
        createdBy: session.userId,
        isActive: true,
      });

      await formatRepo.save(newFormat);
      return NextResponse.json({ format: newFormat }, { status: 201 });
    }

    // If template is provided directly, create new format
    if (!name || !template) {
      return NextResponse.json(
        { message: 'Name and template are required' },
        { status: 400 }
      );
    }

    const newFormat = formatRepo.create({
      name,
      template,
      config: config || null,
      shopId: session.shopId,
      createdBy: session.userId,
      isActive: true,
    });

    await formatRepo.save(newFormat);
    return NextResponse.json({ format: newFormat }, { status: 201 });
  } catch (error) {
    console.error('Error importing post format:', error);
    return NextResponse.json(
      { message: 'Failed to import format' },
      { status: 500 }
    );
  }
}
