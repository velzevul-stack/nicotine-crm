import { subDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Sale, SaleItem } from '@/lib/db/entities';
import type { DayReportRow, SaleRowWithCalculations } from '@/services/reports/reports.types';

export { DEFAULT_SHOP_TZ } from '@/services/reports/reports.constants';
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function startOfCalendarDayUtc(ymd: string, timeZone: string): Date {
  return fromZonedTime(`${ymd}T00:00:00.000`, timeZone);
}

export function endOfCalendarDayUtc(ymd: string, timeZone: string): Date {
  return fromZonedTime(`${ymd}T23:59:59.999`, timeZone);
}

export function toNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : fallback;
  return Number.isFinite(n) ? n : fallback;
}

export function safeDate(v: unknown): Date | null {
  const d = v instanceof Date ? v : new Date(v as never);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function resolveReportPeriod(input: {
  daysParam: string | null;
  fromParam: string | null;
  toParam: string | null;
  timeZone: string;
  now?: Date;
}): { from: Date; to: Date } {
  const now = input.now ?? new Date();
  let fromParam = input.fromParam;
  let toParam = input.toParam;
  const { daysParam, timeZone } = input;

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
    const anchor = subDays(now, days);
    const fromYmd = formatInTimeZone(anchor, timeZone, 'yyyy-MM-dd');
    const toYmd = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    from = startOfCalendarDayUtc(fromYmd, timeZone);
    to = endOfCalendarDayUtc(toYmd, timeZone);
  } else if (daysParam === 'all') {
    from = startOfCalendarDayUtc('2020-01-01', timeZone);
    const toYmd = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    to = endOfCalendarDayUtc(toYmd, timeZone);
  } else {
    const parsed = daysParam ? Number.parseInt(daysParam, 10) : NaN;
    const days = Number.isFinite(parsed) ? clampInt(parsed, 1, 365) : 30;
    const anchor = subDays(now, days);
    const fromYmd = formatInTimeZone(anchor, timeZone, 'yyyy-MM-dd');
    const toYmd = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    from = startOfCalendarDayUtc(fromYmd, timeZone);
    to = endOfCalendarDayUtc(toYmd, timeZone);
  }

  return { from, to };
}

export function groupSaleItemsBySaleId(items: SaleItem[]): Map<string, SaleItem[]> {
  const itemsBySaleId = new Map<string, SaleItem[]>();
  for (const it of items) {
    const list = itemsBySaleId.get(it.saleId) ?? [];
    list.push(it);
    itemsBySaleId.set(it.saleId, list);
  }
  return itemsBySaleId;
}

export function enrichSalesWithCalculations(
  salesList: Sale[],
  itemsBySaleId: Map<string, SaleItem[]>,
): SaleRowWithCalculations[] {
  return salesList
    .map((s) => {
      const dt = safeDate((s as Sale).datetime);
      if (!dt) return null;
      const sItems = itemsBySaleId.get(s.id) ?? [];
      const saleCost = sItems.reduce(
        (sum, i) => sum + toNumber(i.costPriceSnapshot, 0) * toNumber(i.quantity, 0),
        0,
      );
      const finalAmount = toNumber((s as Sale).finalAmount, 0);
      const discountValue = toNumber((s as Sale).discountValue, 0);
      const cashAmount = (s as Sale).cashAmount != null ? toNumber((s as Sale).cashAmount, 0) : null;
      const cardAmount = (s as Sale).cardAmount != null ? toNumber((s as Sale).cardAmount, 0) : null;
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
    .filter(Boolean) as SaleRowWithCalculations[];
}

export function aggregateSalesIntoDayReports(
  sales: SaleRowWithCalculations[],
  cardMap: Map<string, string>,
  timeZone: string,
): DayReportRow[] {
  const byDate = new Map<string, DayReportRow>();

  for (const s of sales) {
    const dateStr = formatInTimeZone(s.datetime, timeZone, 'yyyy-MM-dd');
    const existing = byDate.get(dateStr);
    const isReservation = (s as Sale).isReservation ?? false;

    const cash = !isReservation
      ? (s.cashAmount ?? ((s as Sale).paymentType === 'cash' ? s.finalAmount : 0))
      : 0;
    const card = !isReservation
      ? (s.cardAmount ?? ((s as Sale).paymentType === 'card' ? s.finalAmount : 0))
      : 0;
    const debt = !isReservation && (s as Sale).paymentType === 'debt' ? s.finalAmount : 0;
    const cardAmountForBreakdown = !isReservation
      ? (s.cardAmount ?? ((s as Sale).paymentType === 'card' ? s.finalAmount : 0))
      : 0;
    const shortDesc =
      s.items?.slice(0, 2).map((i) => `${toNumber(i.quantity, 0)}×${i.flavorNameSnapshot}`).join(', ') ?? '';
    const cardKey = (s as Sale).cardId ?? '__no_card__';

    if (!existing) {
      const cardBreakdownMap = new Map<string, number>();
      if (cardAmountForBreakdown > 0) cardBreakdownMap.set(cardKey, cardAmountForBreakdown);
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

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
