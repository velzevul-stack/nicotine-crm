import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  type StockItem,
  DebtEntity,
  DebtOperationEntity,
  FlavorEntity,
} from '@/lib/db/entities';
import { z } from 'zod';
import { logStockMovement } from '@/lib/stock-movement-log';
import { buildConsumableFlavorIdSet } from '@/lib/consumable-category';

const updateSchema = z.object({
  paymentType: z.enum(['cash', 'card', 'split', 'debt']).optional(),
  cashAmount: z.number().min(0).optional(),
  cardAmount: z.number().min(0).optional(),
  cardId: z.string().uuid().nullable().optional(),
  discountValue: z.number().min(0).optional(),
  discountType: z.enum(['absolute', 'percent']).optional(),
  comment: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  saleDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)]).optional(),
  isReservation: z.boolean().optional(),
  reservationExpiry: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)]).nullable().optional(),
  deliveryAmount: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        flavorId: z.string().uuid(),
        productNameSnapshot: z.string(),
        flavorNameSnapshot: z.string(),
        unitPrice: z.number(),
        quantity: z.number().int().min(1),
        lineTotal: z.number(),
      })
    )
    .min(1)
    .optional(),
});

function getWarehouseAvailable(stock: StockItem | null): number {
  return Math.max(0, (stock?.quantity ?? 0) - (stock?.reservedQuantity ?? 0));
}

function getPostAvailable(stock: StockItem | null): number {
  return Math.max(0, stock?.postQuantity ?? 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  const sale = await ds.getRepository(SaleEntity).findOne({
    where: { id, shopId: session.shopId },
  });

  if (!sale) {
    return NextResponse.json({ message: 'Sale not found' }, { status: 404 });
  }

  const items = await ds.getRepository(SaleItemEntity).find({
    where: { saleId: sale.id },
  });

  return NextResponse.json({
    ...sale,
    items,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  return ds.transaction(async (em) => {
    const sale = await em.getRepository(SaleEntity).findOne({
      where: { id, shopId: session.shopId },
    });

    if (!sale) {
      throw new Error('Sale not found');
    }

    if (sale.status === 'deleted') {
      throw new Error('Cannot edit deleted sale');
    }

    const oldItems = await em.getRepository(SaleItemEntity).find({
      where: { saleId: sale.id },
    });
    const effectivePaymentType = parsed.data.paymentType ?? sale.paymentType;
    const effectiveIsReservation = parsed.data.isReservation ?? sale.isReservation;

    // If items are being updated, recalculate totals and restore stock
    if (parsed.data.items !== undefined) {
      const consumableFlavorIds = await buildConsumableFlavorIdSet(
        em,
        session.shopId,
        [...new Set([...oldItems.map((o) => o.flavorId), ...parsed.data.items.map((i) => i.flavorId)])]
      );

      // Restore stock from old items
      for (const oldItem of oldItems) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: oldItem.flavorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (stock) {
          if (sale.isReservation) {
            const beforePostQty = stock.postQuantity ?? 0;
            const beforeReserved = stock.reservedQuantity ?? 0;
            stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - oldItem.quantity);
            stock.postQuantity = beforePostQty + oldItem.quantity;
            await logStockMovement(em, {
              shopId: session.shopId,
              productId: oldItem.flavorId,
              productName: `${oldItem.productNameSnapshot} ${oldItem.flavorNameSnapshot}`.trim(),
              actionType: 'cancel_sale',
              fromZone: 'warehouse',
              toZone: 'post',
              quantity: oldItem.quantity,
              postStockBefore: beforePostQty,
              postStockAfter: stock.postQuantity,
              warehouseBefore: stock.quantity,
              warehouseAfter: stock.quantity,
              contextType: 'reservation',
              contextId: sale.id,
              comment: `Снятие резерва (редактирование) #${sale.id.slice(0, 8)}: ${beforeReserved} -> ${stock.reservedQuantity ?? 0}`,
            });
          } else {
            const beforeQty = stock.quantity;
            const beforePostQty = stock.postQuantity ?? 0;
            stock.quantity += oldItem.quantity;
            // Всегда откатываем витрину так же, как при продаже списывали (в т.ч. расходники).
            stock.postQuantity = beforePostQty + oldItem.quantity;
            await logStockMovement(em, {
              shopId: session.shopId,
              productId: oldItem.flavorId,
              productName: `${oldItem.productNameSnapshot} ${oldItem.flavorNameSnapshot}`.trim(),
              actionType: 'cancel_sale',
              fromZone: null,
              toZone: 'warehouse',
              quantity: oldItem.quantity,
              postStockBefore: beforePostQty,
              postStockAfter: stock.postQuantity,
              warehouseBefore: beforeQty,
              warehouseAfter: stock.quantity,
              contextType: effectivePaymentType === 'debt' ? 'debt' : 'sale',
              contextId: sale.id,
              comment: `Отмена (редактирование) чека #${sale.id.slice(0, 8)}`,
            });
          }
          await em.getRepository(StockItemEntity).save(stock);
        }
      }

      // Delete old items
      await em.getRepository(SaleItemEntity).delete({ saleId: sale.id });

      // Validate new stock availability and flavor ownership
      for (const it of parsed.data.items) {
        // Проверяем, что flavor принадлежит правильному магазину
        const flavor = await em.getRepository(FlavorEntity).findOne({
          where: { id: it.flavorId, shopId: session.shopId },
        });
        
        if (!flavor) {
          throw new Error(`Товар не найден или не принадлежит вашему магазину: ${it.flavorNameSnapshot}`);
        }
        
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: it.flavorId },
          lock: { mode: 'pessimistic_write' },
        });
        const warehouseAvailable = getWarehouseAvailable(stock);
        const postAvailable = getPostAvailable(stock);
        const isCon = consumableFlavorIds.has(it.flavorId);
        const sellableNonCon =
          postAvailable <= 0 ? warehouseAvailable : Math.min(warehouseAvailable, postAvailable);
        const avail = isCon ? warehouseAvailable : sellableNonCon;
        if (isCon) {
          if (warehouseAvailable < it.quantity) {
            throw new Error(`Недостаточно товара: ${it.flavorNameSnapshot} (доступно ${avail})`);
          }
        } else if (sellableNonCon < it.quantity) {
          throw new Error(`Недостаточно товара: ${it.flavorNameSnapshot} (доступно ${avail})`);
        }
      }

      // Create new items and update stock
      const totalAmount = parsed.data.items.reduce((s, i) => s + i.lineTotal, 0);
      const discountValue = parsed.data.discountValue ?? sale.discountValue;
      const discountType = parsed.data.discountType ?? sale.discountType;
      const discountAmount =
        discountType === 'percent'
          ? (totalAmount * discountValue) / 100
          : discountValue;
      const deliveryAmt =
        parsed.data.deliveryAmount !== undefined
          ? parsed.data.deliveryAmount
          : (sale.deliveryAmount ?? 0);
      const finalAmount = Math.max(0, totalAmount - discountAmount + deliveryAmt);

      sale.totalAmount = totalAmount;
      sale.discountValue = discountAmount;
      sale.discountType = discountType;
      sale.deliveryAmount = deliveryAmt;
      sale.finalAmount = finalAmount;

      for (const it of parsed.data.items) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: it.flavorId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!stock) {
          throw new Error(`Stock not found for flavor ${it.flavorId}`);
        }

        const si = em.getRepository(SaleItemEntity).create({
          saleId: sale.id,
          flavorId: it.flavorId,
          productNameSnapshot: it.productNameSnapshot,
          flavorNameSnapshot: it.flavorNameSnapshot,
          unitPrice: it.unitPrice,
          costPriceSnapshot: stock.costPrice ?? 0,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
        });
        await em.getRepository(SaleItemEntity).save(si);

        if (effectiveIsReservation) {
          const beforePostQty = stock.postQuantity ?? 0;
          stock.reservedQuantity = (stock.reservedQuantity ?? 0) + it.quantity;
          stock.postQuantity = Math.max(0, beforePostQty - it.quantity);
          await logStockMovement(em, {
            shopId: session.shopId,
            productId: it.flavorId,
            productName: `${it.productNameSnapshot} ${it.flavorNameSnapshot}`.trim(),
            actionType: 'manual_transfer',
            fromZone: 'post',
            toZone: 'warehouse',
            quantity: it.quantity,
            postStockBefore: beforePostQty,
            postStockAfter: stock.postQuantity,
            warehouseBefore: stock.quantity,
            warehouseAfter: stock.quantity,
            contextType: 'reservation',
            contextId: sale.id,
            comment: `Резерв (редактирование) #${sale.id.slice(0, 8)}`,
          });
        } else {
          const beforeQty = stock.quantity;
          const beforePostQty = stock.postQuantity ?? 0;
          stock.quantity -= it.quantity;
          const isConLine = consumableFlavorIds.has(it.flavorId);
          if (!isConLine) {
            stock.postQuantity = Math.max(0, beforePostQty - it.quantity);
          }
          await logStockMovement(em, {
            shopId: session.shopId,
            productId: it.flavorId,
            productName: `${it.productNameSnapshot} ${it.flavorNameSnapshot}`.trim(),
            actionType: effectivePaymentType === 'debt' ? 'debt_sale' : 'sale',
            fromZone: 'warehouse',
            toZone: null,
            quantity: it.quantity,
            postStockBefore: beforePostQty,
            postStockAfter: stock.postQuantity,
            warehouseBefore: beforeQty,
            warehouseAfter: stock.quantity,
            contextType: effectivePaymentType === 'debt' ? 'debt' : 'sale',
            contextId: sale.id,
            comment: `Редактирование чека #${sale.id.slice(0, 8)}`,
          });
        }
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    if (parsed.data.items === undefined && parsed.data.deliveryAmount !== undefined) {
      sale.deliveryAmount = parsed.data.deliveryAmount;
      sale.finalAmount = Math.max(
        0,
        sale.totalAmount - sale.discountValue + sale.deliveryAmount
      );
      if (sale.paymentType === 'cash') {
        sale.cashAmount = sale.finalAmount;
        sale.cardAmount = 0;
      } else if (sale.paymentType === 'card') {
        sale.cashAmount = 0;
        sale.cardAmount = sale.finalAmount;
      } else if (sale.paymentType === 'debt') {
        sale.cashAmount = 0;
        sale.cardAmount = 0;
      }
    }

    // Update other fields
    const final = sale.finalAmount;
    if (parsed.data.paymentType !== undefined) {
      sale.paymentType = parsed.data.paymentType;
      if (parsed.data.paymentType === 'split') {
        const cash = parsed.data.cashAmount ?? sale.cashAmount ?? 0;
        const card = parsed.data.cardAmount ?? sale.cardAmount ?? 0;
        if (Math.abs(cash + card - final) > 0.01) {
          return NextResponse.json(
            { message: 'Сумма наличных и карты должна равняться итоговой сумме' },
            { status: 400 },
          );
        }
        sale.cashAmount = cash;
        sale.cardAmount = card;
      } else if (parsed.data.paymentType === 'cash') {
        sale.cashAmount = final;
        sale.cardAmount = 0;
      } else if (parsed.data.paymentType === 'card') {
        sale.cashAmount = 0;
        sale.cardAmount = final;
      } else if (parsed.data.paymentType === 'debt') {
        sale.cashAmount = 0;
        sale.cardAmount = 0;
      }
    }
    if (sale.paymentType === 'split') {
      if (parsed.data.cashAmount !== undefined) sale.cashAmount = parsed.data.cashAmount;
      if (parsed.data.cardAmount !== undefined) sale.cardAmount = parsed.data.cardAmount;
      if (Math.abs((sale.cashAmount ?? 0) + (sale.cardAmount ?? 0) - final) > 0.01) {
        return NextResponse.json(
          { message: 'Для split-оплаты сумма наличных и карты должна совпадать с итогом' },
          { status: 400 },
        );
      }
    }
    if (parsed.data.cardId !== undefined) sale.cardId = parsed.data.cardId;
    if (parsed.data.comment !== undefined) {
      sale.comment = parsed.data.comment;
    }
    if (parsed.data.customerName !== undefined) {
      sale.customerName = parsed.data.customerName?.trim() || null;
    }
    if (parsed.data.saleDate !== undefined && parsed.data.saleDate) {
      const dateStr = parsed.data.saleDate;
      const next = new Date(dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr}:00`);
      sale.saleDate = next;
      sale.datetime = next;
    }
    if (parsed.data.isReservation !== undefined) {
      sale.isReservation = parsed.data.isReservation;
    }
    if (sale.paymentType === 'debt') {
      if (!sale.customerName?.trim()) {
        return NextResponse.json(
          { message: 'Для продажи в долг укажите имя клиента' },
          { status: 400 },
        );
      }
      sale.cashAmount = 0;
      sale.cardAmount = 0;
    }
    if (parsed.data.reservationExpiry !== undefined) {
      if (parsed.data.reservationExpiry) {
        const dateStr = parsed.data.reservationExpiry;
        sale.reservationExpiry = new Date(dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr}:00`);
      } else {
        sale.reservationExpiry = null;
      }
    }

    sale.status = 'edited';
    await em.getRepository(SaleEntity).save(sale);

    // Keep debt ledgers consistent when payment type/customer/amount changes.
    const existingOps = await em.getRepository(DebtOperationEntity).find({
      where: { saleId: sale.id },
    });
    if (existingOps.length > 0) {
      const byDebtId = new Map<string, number>();
      for (const op of existingOps) {
        byDebtId.set(op.debtId, (byDebtId.get(op.debtId) ?? 0) + op.amount);
      }
      for (const [debtId, amount] of byDebtId.entries()) {
        const debt = await em.getRepository(DebtEntity).findOne({
          where: { id: debtId, shopId: session.shopId },
        });
        if (debt) {
          debt.totalDebt = Math.max(0, debt.totalDebt - amount);
          await em.getRepository(DebtEntity).save(debt);
        }
      }
      await em.getRepository(DebtOperationEntity).delete({ saleId: sale.id });
    }

    if (sale.paymentType === 'debt' && sale.customerName?.trim()) {
      const debtCustomer = sale.customerName.trim();
      let debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: session.shopId, customerName: debtCustomer },
      });
      if (!debt) {
        debt = em.getRepository(DebtEntity).create({
          shopId: session.shopId,
          customerName: debtCustomer,
          totalDebt: 0,
        });
        await em.getRepository(DebtEntity).save(debt);
      }
      debt.totalDebt += sale.finalAmount;
      await em.getRepository(DebtEntity).save(debt);

      const debtOp = em.getRepository(DebtOperationEntity).create({
        debtId: debt.id,
        saleId: sale.id,
        amount: sale.finalAmount,
        datetime: new Date(),
        comment: `Редактирование продажи #${sale.id.slice(0, 8)}`,
      });
      await em.getRepository(DebtOperationEntity).save(debtOp);
    }

    const updatedItems = await em.getRepository(SaleItemEntity).find({
      where: { saleId: sale.id },
    });

    return NextResponse.json({
      ...sale,
      items: updatedItems,
    });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();

  return ds.transaction(async (em) => {
    const sale = await em.getRepository(SaleEntity).findOne({
      where: { id, shopId: session.shopId },
    });

    if (!sale) {
      return NextResponse.json({ message: 'Sale not found' }, { status: 404 });
    }

    if (sale.status === 'deleted') {
      return NextResponse.json({ message: 'Sale already deleted' }, { status: 400 });
    }

    const items = await em.getRepository(SaleItemEntity).find({
      where: { saleId: sale.id },
    });

    const consumableFlavorIds = await buildConsumableFlavorIdSet(
      em,
      session.shopId,
      items.map((i) => i.flavorId)
    );

    // Restore stock
    for (const item of items) {
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: session.shopId, flavorId: item.flavorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (stock) {
        if (sale.isReservation) {
          const beforePostQty = stock.postQuantity ?? 0;
          const beforeReserved = stock.reservedQuantity ?? 0;
          stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
          if (!consumableFlavorIds.has(item.flavorId)) {
            stock.postQuantity = beforePostQty + item.quantity;
          }
          await logStockMovement(em, {
            shopId: session.shopId,
            productId: item.flavorId,
            productName: `${item.productNameSnapshot} ${item.flavorNameSnapshot}`.trim(),
            actionType: 'cancel_sale',
            fromZone: 'warehouse',
            toZone: 'post',
            quantity: item.quantity,
            postStockBefore: beforePostQty,
            postStockAfter: stock.postQuantity,
            warehouseBefore: stock.quantity,
            warehouseAfter: stock.quantity,
            contextType: 'reservation',
            contextId: sale.id,
            comment: `Отмена резерва #${sale.id.slice(0, 8)}: ${beforeReserved} -> ${stock.reservedQuantity ?? 0}`,
          });
        } else {
          const beforeQty = stock.quantity;
          const beforePostQty = stock.postQuantity ?? 0;
          stock.quantity += item.quantity;
          if (!consumableFlavorIds.has(item.flavorId)) {
            stock.postQuantity = beforePostQty + item.quantity;
          }
          await logStockMovement(em, {
            shopId: session.shopId,
            productId: item.flavorId,
            productName: `${item.productNameSnapshot} ${item.flavorNameSnapshot}`.trim(),
            actionType: 'cancel_sale',
            fromZone: null,
            toZone: 'warehouse',
            quantity: item.quantity,
            postStockBefore: beforePostQty,
            postStockAfter: stock.postQuantity,
            warehouseBefore: beforeQty,
            warehouseAfter: stock.quantity,
            contextType: sale.paymentType === 'debt' ? 'debt' : 'sale',
            contextId: sale.id,
            comment: `Отмена чека #${sale.id.slice(0, 8)}`,
          });
        }
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    // Update debt if it was a debt sale
    if (sale.paymentType === 'debt' && sale.customerName) {
      const debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: session.shopId, customerName: sale.customerName.trim() },
      });
      if (debt) {
        debt.totalDebt = Math.max(0, debt.totalDebt - sale.finalAmount);
        await em.getRepository(DebtEntity).save(debt);
      }
      // Delete debt operations
      await em.getRepository(DebtOperationEntity).delete({ saleId: sale.id });
    }

    // Mark sale as deleted
    sale.status = 'deleted';
    await em.getRepository(SaleEntity).save(sale);

    return NextResponse.json({ message: 'Sale deleted successfully' });
  });
}
