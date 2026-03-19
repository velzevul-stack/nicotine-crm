import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { CardEntity } from '@/lib/db/entities';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  const cards = await ds.getRepository(CardEntity).find({
    where: { shopId: session.shopId },
    order: { sortOrder: 'ASC', name: 'ASC' },
  });

  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(CardEntity);

  const maxOrder = await repo
    .createQueryBuilder('c')
    .select('MAX(c.sortOrder)', 'max')
    .where('c.shopId = :shopId', { shopId: session.shopId })
    .getRawOne();

  const card = repo.create({
    shopId: session.shopId,
    name: parsed.data.name.trim(),
    sortOrder: (maxOrder?.max ?? 0) + 1,
  });
  await repo.save(card);

  return NextResponse.json(card);
}
