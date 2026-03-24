import type { DataSource, EntityManager } from 'typeorm';
import { In } from 'typeorm';
import { format } from 'date-fns';
import {
  SaleEntity,
  SaleItemEntity,
  StockItemEntity,
  FlavorEntity,
  ProductFormatEntity,
  DebtEntity,
  DebtOperationEntity,
  CardEntity,
  PostFormatEntity,
  ShopEntity,
} from '../../lib/db/entities';
import type { PaymentType } from '../../lib/db/entities/Sale';
import type { Flavor } from '../../lib/db/entities/Flavor';
import type { StockItem } from '../../lib/db/entities/StockItem';
import type { ProductFormat } from '../../lib/db/entities/ProductFormat';
import type { Card } from '../../lib/db/entities/Card';

/** Префикс в `sales.comment` для демо-продаж. Идемпотентность: любая версия `__seed_%`. */
export const SEED_SALE_COMMENT_PREFIX = '__seed_v2:';

type FlavorRow = {
  flavor: Flavor;
  stock: StockItem;
  format: ProductFormat;
};

function daysAgo(days: number, hour = 12, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dayKeyFromDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Прибыль дня в отчётах: finalAmount − себестоимость строк (резервы не учитываются). */
function addSeedDayProfit(
  map: Map<string, number>,
  when: Date,
  isReservation: boolean,
  finalAmount: number,
  lines: { row: FlavorRow; qty: number }[]
) {
  if (isReservation) return;
  const cost = lines.reduce((s, l) => s + (l.row.stock.costPrice ?? 0) * l.qty, 0);
  const key = dayKeyFromDate(when);
  map.set(key, (map.get(key) ?? 0) + (finalAmount - cost));
}

async function loadFlavorRows(em: EntityManager, shopId: string): Promise<FlavorRow[]> {
  const stockRepo = em.getRepository(StockItemEntity);
  const flavorRepo = em.getRepository(FlavorEntity);
  const formatRepo = em.getRepository(ProductFormatEntity);

  const stocks = await stockRepo.find({ where: { shopId } });
  if (stocks.length === 0) return [];

  const flavorIds = [...new Set(stocks.map((s) => s.flavorId))];
  const flavors = await flavorRepo.find({
    where: { shopId, id: In(flavorIds) },
  });
  const formats = await formatRepo.find({ where: { shopId } });
  const formatMap = new Map(formats.map((f) => [f.id, f]));

  const rows: FlavorRow[] = [];
  for (const st of stocks) {
    const fl = flavors.find((f) => f.id === st.flavorId);
    const pf = fl ? formatMap.get(fl.productFormatId) : undefined;
    if (fl && pf) rows.push({ flavor: fl, stock: st, format: pf });
  }
  rows.sort((a, b) => a.flavor.name.localeCompare(b.flavor.name, 'ru'));
  return rows;
}

/** Гарантируем запас под демо-продажи (доступно = quantity - reservedQuantity). */
async function ensureMinAvailable(em: EntityManager, rows: FlavorRow[], minEach: number): Promise<void> {
  const stockRepo = em.getRepository(StockItemEntity);
  for (const r of rows) {
    const avail = r.stock.quantity - (r.stock.reservedQuantity ?? 0);
    if (avail < minEach) {
      r.stock.quantity += minEach - avail;
      await stockRepo.save(r.stock);
    }
  }
}

let pickCursor = 0;
function pickRow(rows: FlavorRow[], qty: number): FlavorRow {
  const n = rows.length;
  if (n === 0) throw new Error('Нет позиций склада для демо-продаж');
  for (let step = 0; step < n; step++) {
    const i = (pickCursor + step) % n;
    const r = rows[i];
    const avail = r.stock.quantity - (r.stock.reservedQuantity ?? 0);
    if (avail >= qty) {
      pickCursor = (i + 1) % n;
      return r;
    }
  }
  throw new Error('Недостаточно остатков для демо-продаж');
}

async function insertSale(
  em: EntityManager,
  ctx: {
    shopId: string;
    sellerId: string;
    when: Date;
    commentSuffix: string;
    paymentType: PaymentType;
    cashAmount: number | null;
    cardAmount: number | null;
    cardId: string | null;
    discountAmount: number;
    discountType: 'absolute' | 'percent';
    /** Сумма доставки (клиент); по умолчанию 0 */
    deliveryAmount?: number;
    finalAmount: number;
    totalAmount: number;
    customerName: string | null;
    isReservation: boolean;
    reservationExpiry: Date | null;
    reservationCustomerName: string | null;
    lines: { row: FlavorRow; qty: number; lineTotal: number }[]
  }
) {
  const saleRepo = em.getRepository(SaleEntity);
  const itemRepo = em.getRepository(SaleItemEntity);
  const stockRepo = em.getRepository(StockItemEntity);

  const totalCost = ctx.lines.reduce(
    (s, l) => s + (l.row.stock.costPrice ?? 0) * l.qty,
    0
  );

  const sale = saleRepo.create({
    shopId: ctx.shopId,
    sellerId: ctx.sellerId,
    datetime: ctx.when,
    saleDate: ctx.when,
    paymentType: ctx.paymentType,
    totalAmount: ctx.totalAmount,
    totalCost,
    discountValue: ctx.discountAmount,
    discountType: ctx.discountType,
    deliveryAmount: ctx.deliveryAmount ?? 0,
    finalAmount: ctx.finalAmount,
    cashAmount: ctx.cashAmount,
    cardAmount: ctx.cardAmount,
    cardId: ctx.cardId,
    comment: `${SEED_SALE_COMMENT_PREFIX}${ctx.commentSuffix}`,
    customerName: ctx.customerName,
    isReservation: ctx.isReservation,
    reservationExpiry: ctx.reservationExpiry,
    reservationCustomerName: ctx.reservationCustomerName,
    status: 'active',
  });
  await saleRepo.save(sale);

  for (const line of ctx.lines) {
    const st = await stockRepo.findOne({
      where: { shopId: ctx.shopId, flavorId: line.row.flavor.id },
    });
    if (!st) throw new Error('stock row missing');

    const si = itemRepo.create({
      saleId: sale.id,
      flavorId: line.row.flavor.id,
      productNameSnapshot: line.row.format.name,
      flavorNameSnapshot: line.row.flavor.name,
      unitPrice: line.row.format.unitPrice,
      costPriceSnapshot: st.costPrice ?? 0,
      quantity: line.qty,
      lineTotal: line.lineTotal,
    });
    await itemRepo.save(si);

    if (ctx.isReservation) {
      st.reservedQuantity = (st.reservedQuantity ?? 0) + line.qty;
    } else {
      st.quantity -= line.qty;
    }
    await stockRepo.save(st);
    line.row.stock = st;
  }

  if (ctx.paymentType === 'debt' && ctx.customerName?.trim()) {
    const debtRepo = em.getRepository(DebtEntity);
    const opRepo = em.getRepository(DebtOperationEntity);
    const name = ctx.customerName.trim();
    let debt = await debtRepo.findOne({ where: { shopId: ctx.shopId, customerName: name } });
    if (!debt) {
      debt = debtRepo.create({ shopId: ctx.shopId, customerName: name, totalDebt: 0 });
      await debtRepo.save(debt);
    }
    debt.totalDebt += ctx.finalAmount;
    await debtRepo.save(debt);
    const op = opRepo.create({
      debtId: debt.id,
      saleId: sale.id,
      amount: ctx.finalAmount,
      datetime: ctx.when,
      comment: `Продажа #${sale.id.slice(0, 8)}`,
    });
    await opRepo.save(op);
  }

  return sale;
}

/**
 * Демо: карты, формат поста (синтаксис {loop:…} / {if:…} из template-parser), продажи, долги.
 * Идемпотентно: если уже есть продажи с comment ~ '^__seed_' (любая версия) — выход.
 */
export async function seedShopDemoTransactions(
  ds: DataSource,
  { shopId, sellerId }: { shopId: string; sellerId: string }
): Promise<void> {
  const saleRepo = ds.getRepository(SaleEntity);
  const existing = await saleRepo
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId })
    .andWhere('s.comment IS NOT NULL')
    .andWhere("s.comment ~ '^__seed_'")
    .getCount();

  if (existing > 0) {
    console.log('Demo transactions: already seeded, skip.');
    return;
  }

  await ds.transaction(async (em) => {
    const rows = await loadFlavorRows(em, shopId);
    await ensureMinAvailable(em, rows, 280);

    const dailyProfit = new Map<string, number>();
    let volumeSeq = 0;

    const cardRepo = em.getRepository(CardEntity);
    const cardNames = ['Основная карта', 'Запасная'];
    const cards: Card[] = [];
    for (const name of cardNames) {
      let c = await cardRepo.findOne({ where: { shopId, name } });
      if (!c) {
        const maxOrder = await cardRepo
          .createQueryBuilder('c')
          .select('MAX(c.sortOrder)', 'max')
          .where('c.shopId = :shopId', { shopId })
          .getRawOne();
        const sortOrder = (maxOrder?.max ?? 0) + 1;
        c = await cardRepo.save(cardRepo.create({ shopId, name, sortOrder }));
      }
      cards.push(c);
    }
    const [cardMain, cardSpare] = cards;

    /** Как в POST /api/post/formats: shopId, name, template, config, createdBy, isActive */
    const postRepo = em.getRepository(PostFormatEntity);
    const demoFmtName = 'Демо: компактный прайс';
    const demoTemplate = `{shop}

{loop:categories}
{if:showCategories}
📁 {category.name}
{/if}
{loop:brands}
{loop:formats}
{loop:flavors}
• {flavor.name}{if:showPrices} — {format.price} BYN{/if}{if:showStock} (ост. {flavor.stock}){/if}
{/loop}
{/loop}
{/loop}
{/loop}`;

    let postFmt = await postRepo.findOne({ where: { shopId, name: demoFmtName } });
    if (!postFmt) {
      postFmt = await postRepo.save(
        postRepo.create({
          shopId,
          name: demoFmtName,
          template: demoTemplate,
          config: {
            showFlavors: true,
            showPrices: true,
            showStock: true,
            showCategories: true,
          },
          createdBy: sellerId,
          isActive: true,
        })
      );
    }
    const shopRepo = em.getRepository(ShopEntity);
    const shop = await shopRepo.findOne({ where: { id: shopId } });
    if (shop && !shop.defaultPostFormatId) {
      shop.defaultPostFormatId = postFmt.id;
      await shopRepo.save(shop);
    }

    pickCursor = 0;

    const DAYS_HISTORY = 45;

    // 0) Сегодня — несколько продаж (нал / карта / split)
    {
      const slots = [
        { h: 9, m: 12, mode: 0 as const },
        { h: 12, m: 45, mode: 1 as const },
        { h: 16, m: 30, mode: 2 as const },
      ];
      for (const slot of slots) {
        const when = daysAgo(0, slot.h, slot.m);
        const a = pickRow(rows, 2);
        const t = a.format.unitPrice * 2;
        const lines = [{ row: a, qty: 2, lineTotal: t }];
        let paymentType: PaymentType = 'cash';
        let cashAmount: number | null = t;
        let cardAmount: number | null = 0;
        let cardId: string | null = null;
        if (slot.mode === 1) {
          paymentType = 'card';
          cashAmount = 0;
          cardAmount = t;
          cardId = cardMain.id;
        } else if (slot.mode === 2) {
          paymentType = 'split';
          cashAmount = Math.floor(t / 2);
          cardAmount = t - (cashAmount ?? 0);
          cardId = cardSpare.id;
        }
        await insertSale(em, {
          shopId,
          sellerId,
          when,
          commentSuffix: `today-${slot.h}-${slot.m}`,
          paymentType,
          cashAmount,
          cardAmount,
          cardId,
          discountAmount: 0,
          discountType: 'absolute',
          finalAmount: t,
          totalAmount: t,
          customerName: null,
          isReservation: false,
          reservationExpiry: null,
          reservationCustomerName: null,
          lines,
        });
        addSeedDayProfit(dailyProfit, when, false, t, lines);
      }
    }

    // 1) Наличные
    {
      const when = daysAgo(2, 11, 20);
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      const lines = [
        { row: a, qty: 1, lineTotal: t1 },
        { row: b, qty: 1, lineTotal: t2 },
      ];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'наличные',
        paymentType: 'cash',
        cashAmount: total,
        cardAmount: 0,
        cardId: null,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines,
      });
      addSeedDayProfit(dailyProfit, when, false, total, lines);
    }

    // 2) Карта
    {
      const when = daysAgo(3, 14, 5);
      const a = pickRow(rows, 2);
      const t = a.format.unitPrice * 2;
      const lines = [{ row: a, qty: 2, lineTotal: t }];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'карта',
        paymentType: 'card',
        cashAmount: 0,
        cardAmount: t,
        cardId: cardMain.id,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: t,
        totalAmount: t,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines,
      });
      addSeedDayProfit(dailyProfit, when, false, t, lines);
    }

    // 3) Split
    {
      const when = daysAgo(4, 10, 40);
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      const cash = Math.floor(total / 2);
      const card = total - cash;
      const lines = [
        { row: a, qty: 1, lineTotal: t1 },
        { row: b, qty: 1, lineTotal: t2 },
      ];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'split',
        paymentType: 'split',
        cashAmount: cash,
        cardAmount: card,
        cardId: cardSpare.id,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines,
      });
      addSeedDayProfit(dailyProfit, when, false, total, lines);
    }

    // 4) Долг + операции
    const debtCustomer = 'Иван Петров';
    let debtSaleFinal = 0;
    {
      const when = daysAgo(5, 15, 0);
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      debtSaleFinal = total;
      const lines = [
        { row: a, qty: 1, lineTotal: t1 },
        { row: b, qty: 1, lineTotal: t2 },
      ];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'долг',
        paymentType: 'debt',
        cashAmount: 0,
        cardAmount: 0,
        cardId: null,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        customerName: debtCustomer,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines,
      });
      addSeedDayProfit(dailyProfit, when, false, total, lines);
    }

    const debtRepo = em.getRepository(DebtEntity);
    const opRepo = em.getRepository(DebtOperationEntity);
    const debtRow = await debtRepo.findOne({
      where: { shopId, customerName: debtCustomer },
    });
    if (debtRow && debtSaleFinal > 0) {
      const payPart = Math.min(20, debtRow.totalDebt);
      debtRow.totalDebt = Math.max(0, debtRow.totalDebt - payPart);
      await debtRepo.save(debtRow);
      const payOp = opRepo.create({
        debtId: debtRow.id,
        saleId: null,
        amount: -payPart,
        datetime: daysAgo(4, 18, 0),
        comment: 'Погашение долга (демо)',
      });
      await opRepo.save(payOp);
    }

    // 5) Скидка суммой
    {
      const when = daysAgo(6, 13, 10);
      const a = pickRow(rows, 2);
      const total = a.format.unitPrice * 2;
      const disc = Math.min(10, total);
      const finalAmt = total - disc;
      const lines = [{ row: a, qty: 2, lineTotal: total }];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'скидка BYN',
        paymentType: 'cash',
        cashAmount: finalAmt,
        cardAmount: 0,
        cardId: null,
        discountAmount: disc,
        discountType: 'absolute',
        finalAmount: finalAmt,
        totalAmount: total,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines,
      });
      addSeedDayProfit(dailyProfit, when, false, finalAmt, lines);
    }

    // 6) Скидка %
    {
      const when = daysAgo(7, 16, 25);
      const a = pickRow(rows, 1);
      const total = a.format.unitPrice;
      const disc = Math.round((total * 20) / 100 * 100) / 100;
      const finalAmt = Math.round((total - disc) * 100) / 100;
      const lines = [{ row: a, qty: 1, lineTotal: total }];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'скидка %',
        paymentType: 'cash',
        cashAmount: finalAmt,
        cardAmount: 0,
        cardId: null,
        discountAmount: disc,
        discountType: 'percent',
        finalAmount: finalAmt,
        totalAmount: total,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines,
      });
      addSeedDayProfit(dailyProfit, when, false, finalAmt, lines);
    }

    // 7) Резерв (в отчёте не даёт выручку/прибыль за день)
    {
      const when = daysAgo(1, 17, 50);
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 3);
      expiry.setHours(23, 59, 0, 0);
      const lines = [
        { row: a, qty: 1, lineTotal: t1 },
        { row: b, qty: 1, lineTotal: t2 },
      ];
      await insertSale(em, {
        shopId,
        sellerId,
        when,
        commentSuffix: 'резерв',
        paymentType: 'cash',
        cashAmount: total,
        cardAmount: 0,
        cardId: null,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        customerName: null,
        isReservation: true,
        reservationExpiry: expiry,
        reservationCustomerName: 'Мария (резерв)',
        lines,
      });
      addSeedDayProfit(dailyProfit, when, true, total, lines);
    }

    // 8) Массовые продажи за последние дни: целевая прибыль по дню 300–500 BYN (как в /api/reports)
    for (let dayIdx = 0; dayIdx < DAYS_HISTORY; dayIdx++) {
      const target = 300 + ((dayIdx * 73 + dayIdx * dayIdx * 5) % 201);
      const anchor = daysAgo(dayIdx, 12, 0);
      const key = dayKeyFromDate(anchor);
      let guard = 0;
      while ((dailyProfit.get(key) ?? 0) < target && guard < 120) {
        guard++;
        volumeSeq++;
        const hour = 8 + ((dayIdx + volumeSeq) % 12);
        const minute = (volumeSeq * 11 + dayIdx) % 60;
        const when = daysAgo(dayIdx, hour, minute);
        const nLines = 1 + ((dayIdx + volumeSeq) % 3);
        const saleLines: { row: FlavorRow; qty: number; lineTotal: number }[] = [];
        let total = 0;
        for (let L = 0; L < nLines; L++) {
          const qty = 1 + ((dayIdx + volumeSeq + L * 3) % 5);
          const row = pickRow(rows, qty);
          const lt = row.format.unitPrice * qty;
          total += lt;
          saleLines.push({ row, qty, lineTotal: lt });
        }
        const mode = (dayIdx + volumeSeq) % 3;
        let paymentType: PaymentType = 'cash';
        let cashAmount: number | null = total;
        let cardAmount: number | null = 0;
        let cardId: string | null = null;
        if (mode === 1) {
          paymentType = 'card';
          cashAmount = 0;
          cardAmount = total;
          cardId = cardMain.id;
        } else if (mode === 2) {
          paymentType = 'split';
          cashAmount = Math.floor(total / 2);
          cardAmount = total - (cashAmount ?? 0);
          cardId = cardSpare.id;
        }
        await insertSale(em, {
          shopId,
          sellerId,
          when,
          commentSuffix: `vol-${key}-${volumeSeq}`,
          paymentType,
          cashAmount,
          cardAmount,
          cardId,
          discountAmount: 0,
          discountType: 'absolute',
          finalAmount: total,
          totalAmount: total,
          customerName: null,
          isReservation: false,
          reservationExpiry: null,
          reservationCustomerName: null,
          lines: saleLines,
        });
        addSeedDayProfit(dailyProfit, when, false, total, saleLines);
      }
    }
  });

  console.log('Demo transactions: seeded (sales, debts, cards, post format).');
}
