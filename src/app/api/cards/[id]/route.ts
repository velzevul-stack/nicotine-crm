import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { CardEntity } from '@/lib/db/entities';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(CardEntity);

  const card = await repo.findOne({
    where: { id, shopId: session.shopId },
  });

  if (!card) {
    return NextResponse.json({ message: 'Card not found' }, { status: 404 });
  }

  if (parsed.data.name !== undefined) card.name = parsed.data.name.trim();
  if (parsed.data.sortOrder !== undefined) card.sortOrder = parsed.data.sortOrder;

  await repo.save(card);

  return NextResponse.json(card);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const ds = await getDataSource();
  const repo = ds.getRepository(CardEntity);

  const card = await repo.findOne({
    where: { id, shopId: session.shopId },
  });

  if (!card) {
    return NextResponse.json({ message: 'Card not found' }, { status: 404 });
  }

  await repo.remove(card);

  return NextResponse.json({ success: true });
}
