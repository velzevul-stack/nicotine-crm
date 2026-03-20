import type { DataSource, EntityManager } from 'typeorm';
import { In } from 'typeorm';
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

/** Префикс в `sales.comment` для демо-продаж (идемпотентность). Не использовать `LIKE` без экранирования — `_` в SQL wildcard. */
export const SEED_SALE_COMMENT_PREFIX = '__seed_v1:';

type FlavorRow = {
  flavor: Flavor;
  stock: StockItem;
  format: ProductFormat;
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0);
  return d;
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
    finalAmount: number;
    totalAmount: number;
    totalCost: number | null;
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

  const sale = saleRepo.create({
    shopId: ctx.shopId,
    sellerId: ctx.sellerId,
    datetime: ctx.when,
    saleDate: ctx.when,
    paymentType: ctx.paymentType,
    totalAmount: ctx.totalAmount,
    totalCost: ctx.totalCost,
    discountValue: ctx.discountAmount,
    discountType: ctx.discountType,
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
 * Демо: карты, продажи (нал / карта / split / долг / скидки / резерв), операции по долгу, формат поста.
 * Идемпотентно: если уже есть продажи с comment, начинающимся с SEED_SALE_COMMENT_PREFIX — выход.
 */
export async function seedShopDemoTransactions(
  ds: DataSource,
  { shopId, sellerId }: { shopId: string; sellerId: string }
): Promise<void> {
  const saleRepo = ds.getRepository(SaleEntity);
  const prefix = SEED_SALE_COMMENT_PREFIX;
  const existing = await saleRepo
    .createQueryBuilder('s')
    .where('s.shopId = :shopId', { shopId })
    .andWhere('s.comment IS NOT NULL')
    .andWhere('LEFT(s.comment, :len) = :pref', { len: prefix.length, pref: prefix })
    .getCount();

  if (existing > 0) {
    console.log('Demo transactions: already seeded, skip.');
    return;
  }

  await ds.transaction(async (em) => {
    const rows = await loadFlavorRows(em, shopId);
    await ensureMinAvailable(em, rows, 8);

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

    const postRepo = em.getRepository(PostFormatEntity);
    const demoFmtName = 'Демо: компактный прайс';
    let postFmt = await postRepo.findOne({ where: { shopId, name: demoFmtName } });
    if (!postFmt) {
      postFmt = await postRepo.save(
        postRepo.create({
          shopId,
          name: demoFmtName,
          template:
            '{{shop}}\n\n{{#categories}}\n📁 {{name}}\n{{#items}}• {{name}} — {{price}} BYN (ост. {{stock}})\n{{/items}}\n{{/categories}}',
          config: { showFlavors: true, showPrices: true, showStock: true, showCategories: true },
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

    // 1) Наличные
    {
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(2),
        commentSuffix: 'наличные',
        paymentType: 'cash',
        cashAmount: total,
        cardAmount: 0,
        cardId: null,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        totalCost: null,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines: [
          { row: a, qty: 1, lineTotal: t1 },
          { row: b, qty: 1, lineTotal: t2 },
        ],
      });
    }

    // 2) Карта
    {
      const a = pickRow(rows, 2);
      const t = a.format.unitPrice * 2;
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(3),
        commentSuffix: 'карта',
        paymentType: 'card',
        cashAmount: 0,
        cardAmount: t,
        cardId: cardMain.id,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: t,
        totalAmount: t,
        totalCost: null,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines: [{ row: a, qty: 2, lineTotal: t }],
      });
    }

    // 3) Split
    {
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      const cash = Math.floor(total / 2);
      const card = total - cash;
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(4),
        commentSuffix: 'split',
        paymentType: 'split',
        cashAmount: cash,
        cardAmount: card,
        cardId: cardSpare.id,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        totalCost: null,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines: [
          { row: a, qty: 1, lineTotal: t1 },
          { row: b, qty: 1, lineTotal: t2 },
        ],
      });
    }

    // 4) Долг + операции
    const debtCustomer = 'Иван Петров';
    let debtSaleFinal = 0;
    {
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      debtSaleFinal = total;
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(5),
        commentSuffix: 'долг',
        paymentType: 'debt',
        cashAmount: 0,
        cardAmount: 0,
        cardId: null,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        totalCost: null,
        customerName: debtCustomer,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines: [
          { row: a, qty: 1, lineTotal: t1 },
          { row: b, qty: 1, lineTotal: t2 },
        ],
      });
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
        datetime: daysAgo(4),
        comment: 'Погашение долга (демо)',
      });
      await opRepo.save(payOp);
    }

    // 5) Скидка суммой
    {
      const a = pickRow(rows, 2);
      const total = a.format.unitPrice * 2;
      const disc = Math.min(10, total);
      const finalAmt = total - disc;
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(6),
        commentSuffix: 'скидка BYN',
        paymentType: 'cash',
        cashAmount: finalAmt,
        cardAmount: 0,
        cardId: null,
        discountAmount: disc,
        discountType: 'absolute',
        finalAmount: finalAmt,
        totalAmount: total,
        totalCost: null,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines: [{ row: a, qty: 2, lineTotal: total }],
      });
    }

    // 6) Скидка %
    {
      const a = pickRow(rows, 1);
      const total = a.format.unitPrice;
      const disc = Math.round((total * 20) / 100 * 100) / 100;
      const finalAmt = Math.round((total - disc) * 100) / 100;
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(7),
        commentSuffix: 'скидка %',
        paymentType: 'cash',
        cashAmount: finalAmt,
        cardAmount: 0,
        cardId: null,
        discountAmount: disc,
        discountType: 'percent',
        finalAmount: finalAmt,
        totalAmount: total,
        totalCost: null,
        customerName: null,
        isReservation: false,
        reservationExpiry: null,
        reservationCustomerName: null,
        lines: [{ row: a, qty: 1, lineTotal: total }],
      });
    }

    // 7) Резерв
    {
      const a = pickRow(rows, 1);
      const b = pickRow(rows, 1);
      const t1 = a.format.unitPrice;
      const t2 = b.format.unitPrice;
      const total = t1 + t2;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 3);
      expiry.setHours(23, 59, 0, 0);
      await insertSale(em, {
        shopId,
        sellerId,
        when: daysAgo(1),
        commentSuffix: 'резерв',
        paymentType: 'cash',
        cashAmount: total,
        cardAmount: 0,
        cardId: null,
        discountAmount: 0,
        discountType: 'absolute',
        finalAmount: total,
        totalAmount: total,
        totalCost: null,
        customerName: null,
        isReservation: true,
        reservationExpiry: expiry,
        reservationCustomerName: 'Мария (резерв)',
        lines: [
          { row: a, qty: 1, lineTotal: t1 },
          { row: b, qty: 1, lineTotal: t2 },
        ],
      });
    }
  });

  console.log('Demo transactions: seeded (sales, debts, cards, post format).');
}
