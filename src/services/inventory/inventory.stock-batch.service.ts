import { applyStockPatchInTransaction, warehouseReceiveBatchSchema } from '@/lib/inventory/stock-patch';
import { ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';

export async function receiveStockBatch(context: ShopContext, body: unknown) {
  const parsed = warehouseReceiveBatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const flavorIds = parsed.data.items.map((i) => i.flavorId);
  if (new Set(flavorIds).size !== flavorIds.length) {
    throw new ValidationError('В одной приёмке один вкус не должен повторяться', undefined, {
      code: 'DUPLICATE_FLAVOR_IN_BATCH',
    });
  }

  const sorted = [...parsed.data.items].sort((a, b) => a.flavorId.localeCompare(b.flavorId));

  const items = await withTransaction(async (em) => {
    const out = [];
    for (const row of sorted) {
      const patch = {
        flavorId: row.flavorId,
        quantity: row.quantity,
        actionType: 'receipt_to_warehouse' as const,
        ...(row.costPrice !== undefined ? { costPrice: row.costPrice } : {}),
        ...(row.comment !== undefined ? { comment: row.comment } : {}),
      };
      out.push(await applyStockPatchInTransaction(em, context.shopId, patch));
    }
    return out;
  });
  return { items };
}
