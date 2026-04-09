import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  applyStockPatchInTransaction,
  warehouseReceiveBatchSchema,
  StockPatchHttpError,
} from '@/lib/inventory/stock-patch';

/**
 * Атомарная приёмка нескольких позиций на склад в одной транзакции (всё или ничего).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = warehouseReceiveBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const flavorIds = parsed.data.items.map((i) => i.flavorId);
  if (new Set(flavorIds).size !== flavorIds.length) {
    return NextResponse.json(
      { message: 'В одной приёмке один вкус не должен повторяться' },
      { status: 400 }
    );
  }

  const sorted = [...parsed.data.items].sort((a, b) => a.flavorId.localeCompare(b.flavorId));

  const ds = await getDataSource();

  try {
    const items = await ds.transaction(async (em) => {
      const out = [];
      for (const row of sorted) {
        const patch = {
          flavorId: row.flavorId,
          quantity: row.quantity,
          actionType: 'receipt_to_warehouse' as const,
          ...(row.costPrice !== undefined ? { costPrice: row.costPrice } : {}),
          ...(row.comment !== undefined ? { comment: row.comment } : {}),
        };
        out.push(await applyStockPatchInTransaction(em, session.shopId, patch));
      }
      return out;
    });
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof StockPatchHttpError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
