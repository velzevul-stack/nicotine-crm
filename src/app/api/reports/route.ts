import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  SaleEntity,
  SaleItemEntity,
  CardEntity,
  ShopEntity,
  type Sale,
  type SaleItem,
} from '@/lib/db/entities';
import { In } from 'typeorm';
import { subDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DEFAULT_SHOP_TZ = 'Europe/Minsk';
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function startOfCalendarDayUtc(ymd: string, timeZone: string): Date {
  return fromZonedTime(`${ymd}T00:00:00.000`, timeZone);
}

function endOfCalendarDayUtc(ymd: string, timeZone: string): Date {
  return fromZonedTime(`${ymd}T23:59:59.999`, timeZone);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const daysParam = request.nextUrl.searchParams.get('days');
    let fromParam = request.nextUrl.searchParams.get('from');
    let toParam = request.nextUrl.searchParams.get('to');
    const reservationsOnly = request.nextUrl.searchParams.get('reservationsOnly') === '1';

    const toNumber = (v: unknown, fallback = 0) => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : fallback;
      return Number.isFinite(n) ? n : fallback;
    };
    const safeDate = (v: unknown): Date | null => {
      const d = v instanceof Date ? v : new Date(v as any);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

    const ds = await getDataSource();
    const shop = await ds.getRepository(ShopEntity).findOne({
      where: { id: session.shopId },
    });
    const timeZone = shop?.timezone && shop.timezone.trim() ? shop.timezone.trim() : DEFAULT_SHOP_TZ;

    let from: Date;
    let to: Date;

    if (fromParam && toParam && YMD_RE.test(fromParam) && YMD_RE.test(toParam)) {
      if (fromParam > toParam) {
        const tmp = fromParam;
        fromParam = toParam;
        toParam = tmp;
      }
      from = startOfCalendarDayUtc(fromParam, timeZone);
      to = endOfCalendarDayUtc(toParam, timeZone);
    } else if (fromParam && toParam) {
      const days = 30;
      const anchor = subDays(new Date(), days);
      const fromYmd = formatInTimeZone(anchor, timeZone, 'yyyy-MM-dd');
      const toYmd = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
      from = startOfCalendarDayUtc(fromYmd, timeZone);
      to = endOfCalendarDayUtc(toYmd, timeZone);
    } else if (daysParam === 'all') {
      from = startOfCalendarDayUtc('2020-01-01', timeZone);
      const toYmd = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
      to = endOfCalendarDayUtc(toYmd, timeZone);
    } else {
      const parsed = daysParam ? Number.parseInt(daysParam, 10) : NaN;
      const days = Number.isFinite(parsed) ? clampInt(parsed, 1, 365) : 30;
      const anchor = subDays(new Date(), days);
      const fromYmd = formatInTimeZone(anchor, timeZone, 'yyyy-MM-dd');
      const toYmd = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
      from = startOfCalendarDayUtc(fromYmd, timeZone);
      to = endOfCalendarDayUtc(toYmd, timeZone);
    }

    const cards = await ds.getRepository(CardEntity).find({
      where: { shopId: session.shopId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const cardMap = new Map(cards.map((c) => [c.id, c.name]));

    const qb = ds
      .getRepository(SaleEntity)
      .createQueryBuilder('s')
      .where('s.shopId = :shopId', { shopId: session.shopId })
      .andWhere('s.status != :status', { status: 'deleted' })
      .andWhere('s.datetime >= :from', { from })
      .andWhere('s.datetime <= :to', { to });

    if (reservationsOnly) {
      qb.andWhere('s.isReservation = :isReservation', { isReservation: true });
    }

    const salesList = await qb.orderBy('s.datetime', 'DESC').getMany();

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

    const sales = salesList
      .map((s) => {
        const dt = safeDate((s as any).datetime);
        if (!dt) return null;

        const sItems = itemsBySaleId.get(s.id) ?? [];
        const saleCost = sItems.reduce(
          (sum, i) => sum + toNumber(i.costPriceSnapshot, 0) * toNumber(i.quantity, 0),
          0
        );

        const finalAmount = toNumber((s as any).finalAmount, 0);
        const discountValue = toNumber((s as any).discountValue, 0);
        const cashAmount = (s as any).cashAmount != null ? toNumber((s as any).cashAmount, 0) : null;
        const cardAmount = (s as any).cardAmount != null ? toNumber((s as any).cardAmount, 0) : null;

        return {
          ...s,
          datetime: dt,
          finalAmount,
          discountValue,
          cashAmount,
          cardAmount,
          items: sItems,
          calculatedCost: saleCost,
          calculatedProfit: finalAmount - saleCost,
        };
      })
      .filter(Boolean) as Array<
      Sale & {
        items: SaleItem[];
        calculatedCost: number;
        calculatedProfit: number;
        finalAmount: number;
        discountValue: number;
        cashAmount: number | null;
        cardAmount: number | null;
        datetime: Date;
      }
    >;

    const byDate = new Map<
      string,
      {
        date: string;
        salesCount: number;
        revenue: number;
        cost: number;
        profit: number;
        cashAmount: number;
        cardAmount: number;
        debtAmount: number;
        cardBreakdown: { cardKey: string; cardName: string; amount: number }[];
        discountTotal: number;
        reservationsCount: number;
        reservationsAmount: number;
        lastSaleTime: string;
        lastSaleDescription: string;
        sales: typeof sales;
      }
    >();

    for (const s of sales) {
      const dateStr = formatInTimeZone(s.datetime, timeZone, 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      const isReservation = (s as any).isReservation ?? false;

      const cash = !isReservation
        ? (s.cashAmount ?? ((s as any).paymentType === 'cash' ? s.finalAmount : 0))
        : 0;
      const card = !isReservation
        ? (s.cardAmount ?? ((s as any).paymentType === 'card' ? s.finalAmount : 0))
        : 0;
      const debt = !isReservation && (s as any).paymentType === 'debt' ? s.finalAmount : 0;

      const cardAmountForBreakdown = !isReservation
        ? (s.cardAmount ?? ((s as any).paymentType === 'card' ? s.finalAmount : 0))
        : 0;

      const shortDesc =
        s.items?.slice(0, 2).map((i) => `${toNumber(i.quantity, 0)}×${(i as any).flavorNameSnapshot}`).join(', ') ??
        '';

      const cardKey = (s as any).cardId ?? '__no_card__';

      if (!existing) {
        const cardBreakdownMap = new Map<string, number>();
        if (cardAmountForBreakdown > 0) {
          cardBreakdownMap.set(cardKey, cardAmountForBreakdown);
        }
        byDate.set(dateStr, {
          date: dateStr,
          salesCount: isReservation ? 0 : 1,
          revenue: isReservation ? 0 : s.finalAmount,
          cost: isReservation ? 0 : s.calculatedCost,
          profit: isReservation ? 0 : s.calculatedProfit,
          cashAmount: cash,
          cardAmount: card,
          debtAmount: debt,
          cardBreakdown: [...cardBreakdownMap.entries()].map(([k, amt]) => ({
            cardKey: k,
            cardName: k === '__no_card__' ? 'Карта' : (cardMap.get(k) ?? 'Карта'),
            amount: amt,
          })),
          discountTotal: isReservation ? 0 : (s.discountValue ?? 0),
          reservationsCount: isReservation ? 1 : 0,
          reservationsAmount: isReservation ? s.finalAmount : 0,
          lastSaleTime: formatInTimeZone(s.datetime, timeZone, 'HH:mm'),
          lastSaleDescription: shortDesc || 'Продажа',
          sales: [s],
        });
      } else {
        if (!isReservation) {
          existing.salesCount++;
          existing.revenue += s.finalAmount;
          existing.cost += s.calculatedCost;
          existing.profit += s.calculatedProfit;
          existing.discountTotal += s.discountValue ?? 0;
        } else {
          existing.reservationsCount++;
          existing.reservationsAmount += s.finalAmount;
        }
        existing.cashAmount += cash;
        existing.cardAmount += card;
        existing.debtAmount += debt;
        if (cardAmountForBreakdown > 0) {
          const prev = existing.cardBreakdown.find((cb) => cb.cardKey === cardKey);
          if (prev) {
            prev.amount += cardAmountForBreakdown;
          } else {
            existing.cardBreakdown.push({
              cardKey,
              cardName: cardKey === '__no_card__' ? 'Карта' : (cardMap.get(cardKey) ?? 'Карта'),
              amount: cardAmountForBreakdown,
            });
          }
        }
        existing.lastSaleTime = formatInTimeZone(s.datetime, timeZone, 'HH:mm');
        existing.lastSaleDescription = shortDesc || existing.lastSaleDescription;
        existing.sales.push(s);
      }
    }

    const dayReports = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      dayReports,
      dateRange: {
        from: formatInTimeZone(from, timeZone, 'yyyy-MM-dd'),
        to: formatInTimeZone(to, timeZone, 'yyyy-MM-dd'),
      },
    });
  } catch (err) {
    console.error('Reports API error:', err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Reports generation failed' },
      { status: 500 }
    );
  }
}
