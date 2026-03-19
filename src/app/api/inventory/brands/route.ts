import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { BrandEntity } from '@/lib/db/entities';

// GET - получить все бренды пользователя
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  
  // Используем транзакцию для предотвращения параллельных запросов
  return ds.transaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);

    const brands = await brandRepo.find({
      where: { shopId: session.shopId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return NextResponse.json({ brands });
  });
}
