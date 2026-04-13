import {
  BrandEntity,
  CategoryEntity,
  DebtEntity,
  DebtOperationEntity,
  FlavorEntity,
  ProductFormatEntity,
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  StockMovementEntity,
} from '@/lib/db/entities';
import { logStockMovement } from '@/services/common/stock-movement.gateway';
import { withTransaction } from '@/services/common/transaction';

export type ClearShopDataContext = { shopId: string };

export async function clearAllShopTradingData(context: ClearShopDataContext) {
  const shopId = context.shopId;

  await withTransaction(async (em) => {
    const sales = await em.getRepository(SaleEntity).find({
      where: { shopId },
    });
    const saleIds = sales.map((s) => s.id);
    if (saleIds.length > 0) {
      await em
        .createQueryBuilder()
        .delete()
        .from(SaleItemEntity)
        .where('saleId IN (:...saleIds)', { saleIds })
        .execute();
    }

    await em
      .createQueryBuilder()
      .delete()
      .from(SaleEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    const debts = await em.getRepository(DebtEntity).find({
      where: { shopId },
    });
    const debtIds = debts.map((d) => d.id);
    if (debtIds.length > 0) {
      await em
        .createQueryBuilder()
        .delete()
        .from(DebtOperationEntity)
        .where('debtId IN (:...debtIds)', { debtIds })
        .execute();
    }

    await em
      .createQueryBuilder()
      .delete()
      .from(DebtEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    const stocks = await em.getRepository(StockItemEntity).find({
      where: { shopId },
    });
    for (const st of stocks) {
      if ((st.quantity ?? 0) > 0) {
        await logStockMovement(em, {
          shopId,
          productId: st.flavorId,
          actionType: 'clear_stock',
          fromZone: 'warehouse',
          toZone: null,
          quantity: st.quantity,
          postStockBefore: st.quantity,
          postStockAfter: 0,
          warehouseBefore: st.quantity,
          warehouseAfter: 0,
          comment: 'Полная очистка остатков',
        });
      }
    }
    await em
      .createQueryBuilder()
      .delete()
      .from(StockItemEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    await em
      .createQueryBuilder()
      .delete()
      .from(FlavorEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    await em
      .createQueryBuilder()
      .delete()
      .from(ProductFormatEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    await em
      .createQueryBuilder()
      .delete()
      .from(BrandEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    await em
      .createQueryBuilder()
      .delete()
      .from(CategoryEntity)
      .where('shopId = :shopId', { shopId })
      .execute();

    await em
      .createQueryBuilder()
      .delete()
      .from(StockMovementEntity)
      .where('shopId = :shopId', { shopId })
      .execute();
  });

  return { message: 'Все данные успешно удалены' as const };
}
