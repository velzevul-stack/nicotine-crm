import type { StockItem } from '@/lib/db/entities';
import { applyStockPatchInTransaction, stockUpdateSchema } from '@/lib/inventory/stock-patch';
import { ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';

export async function patchStockItem(context: ShopContext, body: unknown): Promise<StockItem> {
  const parsed = stockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }
  return withTransaction((em) => applyStockPatchInTransaction(em, context.shopId, parsed.data));
}
