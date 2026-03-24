import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  FlavorEntity,
  ProductFormatEntity,
  DebtEntity,
  DebtOperationEntity,
} from '@/lib/db/entities';
import { In } from 'typeorm';
import { z } from 'zod';

const itemSchema = z.object({
  flavorId: z.string().uuid(),
  productNameSnapshot: z.string(),
  flavorNameSnapshot: z.string(),
  unitPrice: z.number(),
  quantity: z.number().int().min(1),
  lineTotal: z.number(),
});

/** Минимум на сколько мс вперёд должен заканчиваться резерв (синхронно с клиентом). */
const RESERVATION_MIN_LEAD_MS = 60_000;

const createSchema = z.object({
  paymentType: z.enum(['cash', 'card', 'split', 'debt']),
  cashAmount: z.number().min(0).optional(),
  cardAmount: z.number().min(0).optional(),
  cardId: z.string().uuid().nullable().optional(),
  discountValue: z.number().min(0).default(0),
  discountType: z.enum(['absolute', 'percent']).default('absolute'),
  comment: z.string().nullable().default(null),
  customerName: z.string().nullable().default(null),
  isReservation: z.boolean().default(false),
  reservationExpiry: z.preprocess(
    (val) => {
      if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
      // Ensure it's a valid ISO datetime string
      if (typeof val === 'string') {
        try {
          const date = new Date(val);
          if (isNaN(date.getTime())) return null;
          return date.toISOString();
        } catch {
          return null;
        }
      }
      return null;
    },
    z.union([z.string().datetime(), z.null()]).optional()
  ),
  reservationCustomerName: z.preprocess(
    (val) => (!val || val === '' || (typeof val === 'string' && val.trim() === '')) ? null : val,
    z.string().nullable().optional()
  ),
  saleDate: z.string().datetime().optional(),
  deliveryAmount: z.number().min(0).default(0),
  items: z.array(itemSchema).min(1),
});

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

  const { paymentType, cashAmount: reqCashAmount, cardAmount: reqCardAmount, cardId, discountValue, discountType, comment, customerName, isReservation, reservationExpiry, reservationCustomerName, saleDate, deliveryAmount, items } =
    parsed.data;

  const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount =
    discountType === 'percent'
      ? Math.min((totalAmount * discountValue) / 100, totalAmount)
      : Math.min(discountValue, totalAmount);
  const finalAmount = Math.max(0, totalAmount - discountAmount + deliveryAmount);

  let cashAmount: number;
  let cardAmount: number;
  if (paymentType === 'split') {
    const cash = reqCashAmount ?? 0;
    const card = reqCardAmount ?? 0;
    if (Math.abs(cash + card - finalAmount) > 0.01) {
      return NextResponse.json(
        { message: 'Сумма наличных и карты должна равняться итоговой сумме' },
        { status: 400 }
      );
    }
    cashAmount = cash;
    cardAmount = card;
  } else if (paymentType === 'cash') {
    cashAmount = finalAmount;
    cardAmount = 0;
  } else if (paymentType === 'debt') {
    if (!customerName?.trim()) {
      return NextResponse.json(
        { message: 'Укажите имя клиента для продажи в долг' },
        { status: 400 }
      );
    }
    cashAmount = 0;
    cardAmount = 0;
  } else {
    cashAmount = 0;
    cardAmount = finalAmount;
  }

  // Validate discount
  if (discountAmount > totalAmount) {
    return NextResponse.json(
      { message: 'Скидка не может быть больше стоимости товаров' },
      { status: 400 }
    );
  }

  if (isReservation) {
    if (!reservationExpiry) {
      return NextResponse.json(
        { message: 'Укажите дату и время окончания резерва' },
        { status: 400 }
      );
    }
    const exp = new Date(reservationExpiry);
    if (Number.isNaN(exp.getTime())) {
      return NextResponse.json(
        { message: 'Некорректная дата окончания резерва' },
        { status: 400 }
      );
    }
    if (exp.getTime() <= Date.now() + RESERVATION_MIN_LEAD_MS) {
      return NextResponse.json(
        {
          message:
            'Резерв должен заканчиваться позже текущего времени (минимум на 1 минуту)',
        },
        { status: 400 }
      );
    }
  }

  const ds = await getDataSource();

  try {
    const result = await ds.transaction(async (em) => {
    // Validate stock and flavor ownership
    for (const it of items) {
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
      const totalQuantity = stock?.quantity ?? 0;
      const reservedQuantity = stock?.reservedQuantity ?? 0;
      const available = totalQuantity - reservedQuantity;
      
      if (isReservation) {
        // For reservations, check total quantity (can reserve from unreserved stock)
        if (available < it.quantity) {
          throw new Error(
            `Недостаточно товара для резерва: ${it.flavorNameSnapshot} (доступно ${available})`
          );
        }
      } else {
        // For regular sales, check available quantity
        if (available < it.quantity) {
          throw new Error(
            `Недостаточно товара: ${it.flavorNameSnapshot} (доступно ${available})`
          );
        }
      }
    }

    const now = new Date();
    const saleDateTime = saleDate ? new Date(saleDate) : now;
    const sale = em.getRepository(SaleEntity).create({
      shopId: session.shopId,
      sellerId: session.userId,
      datetime: now,
      saleDate: saleDateTime,
      paymentType,
      totalAmount,
      totalCost: null,
      discountValue: discountAmount,
      discountType,
      deliveryAmount,
      finalAmount,
      cashAmount,
      cardAmount,
      cardId: cardId ?? null,
      comment,
      customerName: customerName?.trim() || null,
      isReservation: isReservation ?? false,
      reservationExpiry: reservationExpiry ? new Date(reservationExpiry) : null,
      reservationCustomerName: isReservation && reservationCustomerName ? reservationCustomerName.trim() : null,
      status: 'active',
    });
    await em.getRepository(SaleEntity).save(sale);

    for (const it of items) {
      let stock = await em.getRepository(StockItemEntity).findOne({
        where: { shopId: session.shopId, flavorId: it.flavorId },
      });

      if (!stock) {
        // Should ideally not happen if validation passed, but for safety
        stock = em.getRepository(StockItemEntity).create({
          shopId: session.shopId,
          flavorId: it.flavorId,
          quantity: 0,
          costPrice: 0,
        });
        await em.getRepository(StockItemEntity).save(stock);
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

      if (isReservation) {
        // For reservations, move quantity to reservedQuantity
        stock.reservedQuantity = (stock.reservedQuantity ?? 0) + it.quantity;
      } else {
        // For regular sales, deduct from quantity
        stock.quantity -= it.quantity;
      }
      await em.getRepository(StockItemEntity).save(stock);
    }

    if (paymentType === 'debt' && customerName?.trim()) {
      const custName = customerName.trim();
      let debt = await em.getRepository(DebtEntity).findOne({
        where: { shopId: session.shopId, customerName: custName },
      });
      if (!debt) {
        debt = em.getRepository(DebtEntity).create({
          shopId: session.shopId,
          customerName: custName,
          totalDebt: 0,
        });
        await em.getRepository(DebtEntity).save(debt);
      }
      debt.totalDebt += finalAmount;
      await em.getRepository(DebtEntity).save(debt);
      const op = em.getRepository(DebtOperationEntity).create({
        debtId: debt.id,
        saleId: sale.id,
        amount: finalAmount,
        datetime: now,
        comment: `Продажа #${sale.id.slice(0, 8)}`,
      });
      await em.getRepository(DebtOperationEntity).save(op);
    }

    return {
      id: sale.id,
      finalAmount,
      datetime: sale.datetime,
    };
  });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Ошибка при оформлении продажи';
    const clientError =
      message.includes('Недостаточно') || message.includes('не найден');
    return NextResponse.json(
      { message },
      { status: clientError ? 400 : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  const ds = await getDataSource();
  const qb = ds
    .getRepository(SaleEntity)
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId: session.shopId })
    .andWhere('s.status != :status', { status: 'deleted' })
    .orderBy('s.datetime', 'DESC');

  if (from) qb.andWhere('s.datetime >= :from', { from });
  if (to) qb.andWhere('s.datetime <= :to', { to });

  const salesList = await qb.take(100).getMany();
  const saleIds = salesList.map((s) => s.id);
  const items =
    saleIds.length > 0
      ? await ds.getRepository(SaleItemEntity).find({
          where: { saleId: In(saleIds) },
        })
      : [];
  const itemsBySaleId = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsBySaleId.get(it.saleId) ?? [];
    list.push(it);
    itemsBySaleId.set(it.saleId, list);
  }
  const sales = salesList.map((s) => ({
    ...s,
    items: itemsBySaleId.get(s.id) ?? [],
  }));
  return NextResponse.json(sales);
}
