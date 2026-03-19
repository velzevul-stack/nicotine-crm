import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDataSource } from '@/lib/db/data-source';
import {
  StockItemEntity,
  SaleEntity,
  SaleItemEntity,
  DebtEntity,
  DebtOperationEntity,
  FlavorEntity,
  ProductFormatEntity,
  BrandEntity,
  CategoryEntity,
} from '@/lib/db/entities';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ds = await getDataSource();
  const shopId = session.shopId;

  try {
    await ds.transaction(async (em) => {
      // 1. Удаляем элементы продаж (SaleItemEntity) через продажи
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

      // 2. Удаляем продажи (SaleEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(SaleEntity)
        .where('shopId = :shopId', { shopId })
        .execute();

      // 3. Удаляем операции по долгам (DebtOperationEntity) через долги
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

      // 4. Удаляем долги (DebtEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(DebtEntity)
        .where('shopId = :shopId', { shopId })
        .execute();

      // 5. Удаляем остатки (StockItemEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(StockItemEntity)
        .where('shopId = :shopId', { shopId })
        .execute();

      // 6. Удаляем вкусы (FlavorEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(FlavorEntity)
        .where('shopId = :shopId', { shopId })
        .execute();

      // 7. Удаляем форматы продуктов (ProductFormatEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(ProductFormatEntity)
        .where('shopId = :shopId', { shopId })
        .execute();

      // 8. Удаляем бренды (BrandEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(BrandEntity)
        .where('shopId = :shopId', { shopId })
        .execute();

      // 9. Удаляем категории (CategoryEntity)
      await em
        .createQueryBuilder()
        .delete()
        .from(CategoryEntity)
        .where('shopId = :shopId', { shopId })
        .execute();
    });

    return NextResponse.json({ message: 'Все данные успешно удалены' });
  } catch (error: any) {
    console.error('Error clearing user data:', error);
    return NextResponse.json(
      { message: 'Ошибка при удалении данных', error: error.message },
      { status: 500 }
    );
  }
}
