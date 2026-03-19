import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { PostFormatEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  template: z.string().min(1),
  isActive: z.boolean().default(true),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  template: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const formats = await formatRepo.find({
    order: { createdAt: 'DESC' },
  });

  return NextResponse.json({ formats });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = formatRepo.create({
    name: parsed.data.name,
    template: parsed.data.template,
    isActive: parsed.data.isActive,
  });

  await formatRepo.save(format);

  return NextResponse.json({ success: true, format });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ message: 'Format ID required' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = await formatRepo.findOne({ where: { id } });
  if (!format) {
    return NextResponse.json({ message: 'Format not found' }, { status: 404 });
  }

  if (parsed.data.name !== undefined) format.name = parsed.data.name;
  if (parsed.data.template !== undefined) format.template = parsed.data.template;
  if (parsed.data.isActive !== undefined) format.isActive = parsed.data.isActive;

  await formatRepo.save(format);

  return NextResponse.json({ success: true, format });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Format ID required' }, { status: 400 });
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  await formatRepo.delete({ id });

  return NextResponse.json({ success: true });
}
