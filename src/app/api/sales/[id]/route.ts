import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  DebtEntity,
  DebtOperationEntity,
  FlavorEntity,
} from '@/lib/db/entities';
import { z } from 'zod';

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

    // If items are being updated, recalculate totals and restore stock
    if (parsed.data.items !== undefined) {
      // Restore stock from old items
      for (const oldItem of oldItems) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: oldItem.flavorId },
        });
        if (stock) {
          if (sale.isReservation) {
            stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - oldItem.quantity);
          } else {
            stock.quantity += oldItem.quantity;
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
        });
        const available = sale.isReservation
          ? (stock?.quantity ?? 0) - (stock?.reservedQuantity ?? 0)
          : (stock?.quantity ?? 0);
        if (available < it.quantity) {
          throw new Error(
            `Недостаточно товара: ${it.flavorNameSnapshot} (доступно ${available})`
          );
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
      const finalAmount = Math.max(0, totalAmount - discountAmount);

      sale.totalAmount = totalAmount;
      sale.discountValue = discountAmount;
      sale.discountType = discountType;
      sale.finalAmount = finalAmount;

      for (const it of parsed.data.items) {
        const stock = await em.getRepository(StockItemEntity).findOne({
          where: { shopId: session.shopId, flavorId: it.flavorId },
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

        if (sale.isReservation) {
          stock.reservedQuantity = (stock.reservedQuantity ?? 0) + it.quantity;
        } else {
          stock.quantity -= it.quantity;
        }
        await em.getRepository(StockItemEntity).save(stock);
      }
    }

    // Update other fields
    const final = sale.finalAmount;
    if (parsed.data.paymentType !== undefined) {
      sale.paymentType = parsed.data.paymentType;
      if (parsed.data.paymentType === 'split') {
        const cash = parsed.data.cashAmount ?? sale.cashAmount ?? 0;
        const card = parsed.data.cardAmount ?? sale.cardAmount ?? 0;
        if (Math.abs(cash + card - final) <= 0.01) {
          sale.cashAmount = cash;
          sale.cardAmount = card;
        }
      } else if (parsed.data.paymentType === 'cash') {
        sale.cashAmount = final;
        sale.cardAmount = 0;
      } else if (parsed.data.paymentType === 'card' || parsed.data.paymentType === 'debt') {
        sale.cashAmount = 0;
        sale.cardAmount = final;
      }
    }
    if (parsed.data.cashAmount !== undefined) sale.cashAmount = parsed.data.cashAmount;
    if (parsed.data.cardAmount !== undefined) sale.cardAmount = parsed.data.cardAmount;
    if (parsed.data.cardId !== undefined) sale.cardId = parsed.data.cardId;
    if (parsed.data.comment !== undefined) {
      sale.comment = parsed.data.comment;
    }
    if (parsed.data.customerName !== undefined) {
      sale.customerName = parsed.data.customerName?.trim() || null;
    }
    if (parsed.data.saleDate !== undefined && parsed.data.saleDate) {
      // Преобразуем формат "yyyy-MM-ddTHH:mm" в Date
      const dateStr = parsed.data.saleDate;
      sale.saleDate = new Date(dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr}:00`);
    }
    if (parsed.data.isReservation !== undefined) {
      sale.isReservation = parsed.data.isReservation;
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

    // Handle debt updates if payment type changed
    if (parsed.data.paymentType === 'debt' && sale.customerName) {
      let debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: session.shopId, customerName: sale.customerName.trim() },
      });
      if (!debt) {
        debt = em.getRepository(DebtEntity).create({
          shopId: session.shopId,
          customerName: sale.customerName.trim(),
          totalDebt: 0,
        });
        await em.getRepository(DebtEntity).save(debt);
      }
      // Recalculate debt based on final amount
      const existingOps = await em.getRepository(DebtOperationEntity).find({
        where: { saleId: sale.id },
      });
      const existingAmount = existingOps.reduce((s, op) => s + op.amount, 0);
      debt.totalDebt = debt.totalDebt - existingAmount + sale.finalAmount;
      await em.getRepository(DebtEntity).save(debt);
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

    // Restore stock
    for (const item of items) {
      const stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: session.shopId, flavorId: item.flavorId },
      });
      if (stock) {
        if (sale.isReservation) {
          stock.reservedQuantity = Math.max(0, (stock.reservedQuantity ?? 0) - item.quantity);
        } else {
          stock.quantity += item.quantity;
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
