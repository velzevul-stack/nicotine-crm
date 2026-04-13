import type { Sale, SaleItem } from '@/lib/db/entities';

/** Продажа с позициями и расчётными полями для отчёта по дням. */
export type SaleRowWithCalculations = Sale & {
  items: SaleItem[];
  calculatedCost: number;
  calculatedProfit: number;
  finalAmount: number;
  discountValue: number;
  cashAmount: number | null;
  cardAmount: number | null;
  datetime: Date;
};

export type CardBreakdownRow = { cardKey: string; cardName: string; amount: number };

/** Одна строка «дня» в ответе `/api/reports`. */
export type DayReportRow = {
  date: string;
  salesCount: number;
  revenue: number;
  cost: number;
  profit: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  cardBreakdown: CardBreakdownRow[];
  discountTotal: number;
  reservationsCount: number;
  reservationsAmount: number;
  lastSaleTime: string;
  lastSaleDescription: string;
  sales: SaleRowWithCalculations[];
};
