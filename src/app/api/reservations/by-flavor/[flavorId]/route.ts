import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { SaleEntity, SaleItemEntity } from '@/lib/db/entities';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flavorId: string }> }
) {
  const { flavorId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  
  // Find reservations that include this flavor
  const saleItems = await ds.getRepository(SaleItemEntity).find({
    where: { flavorId },
  });

  const saleIds = [...new Set(saleItems.map((si) => si.saleId))];
  
  const reservations =
    saleIds.length > 0
      ? await ds.getRepository(SaleEntity).find({
          where: saleIds.map((id) => ({
            id,
            shopId: session.shopId,
            isReservation: true,
            status: 'active',
          })) as any,
        })
      : [];

  return NextResponse.json(reservations);
}
