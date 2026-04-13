import { formatInTimeZone } from 'date-fns-tz';
import { getDataSource } from '@/lib/db/data-source';
import type { ShopContext } from '@/services/common/service-context';
import {
  aggregateSalesIntoDayReports,
  enrichSalesWithCalculations,
  groupSaleItemsBySaleId,
  resolveReportPeriod,
} from '@/services/reports/reports.aggregator';
import {
  loadCardsForShop,
  loadSaleItemsBySaleIds,
  loadSalesInReportRange,
  resolveShopTimeZone,
} from '@/services/reports/reports.repository';

export async function buildPeriodReport(
  context: ShopContext,
  searchParams: URLSearchParams,
): Promise<{
  dayReports: ReturnType<typeof aggregateSalesIntoDayReports>;
  dateRange: { from: string; to: string };
}> {
  const daysParam = searchParams.get('days');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const reservationsOnly = searchParams.get('reservationsOnly') === '1';

  const ds = await getDataSource();
  const timeZone = await resolveShopTimeZone(ds, context.shopId);

  const { from, to } = resolveReportPeriod({
    daysParam,
    fromParam,
    toParam,
    timeZone,
    now: context.now,
  });

  const cards = await loadCardsForShop(ds, context.shopId);
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  const salesList = await loadSalesInReportRange(ds, {
    shopId: context.shopId,
    from,
    to,
    reservationsOnly,
  });
  const saleIds = salesList.map((s) => s.id);
  const items = await loadSaleItemsBySaleIds(ds, saleIds);

  const itemsBySaleId = groupSaleItemsBySaleId(items);
  const sales = enrichSalesWithCalculations(salesList, itemsBySaleId);
  const dayReports = aggregateSalesIntoDayReports(sales, cardMap, timeZone);

  return {
    dayReports,
    dateRange: {
      from: formatInTimeZone(from, timeZone, 'yyyy-MM-dd'),
      to: formatInTimeZone(to, timeZone, 'yyyy-MM-dd'),
    },
  };
}
