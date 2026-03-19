'use client';

import { memo } from 'react';
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { TrendingUp, TrendingDown, BarChart3, PieChart, LineChart } from 'lucide-react';

interface ChartData {
  date: string;
  fullDate: string;
  revenue: number;
  profit: number;
  salesCount: number;
  cost: number;
}

interface PaymentData {
  name: string;
  value: number;
  color: string;
}

interface ReportsChartsSectionProps {
  chartData: ChartData[];
  paymentData: PaymentData[];
  analytics: {
    avgRevenue: number;
    avgProfit: number;
    avgSales: number;
    totalRevenue: number;
    totalSales: number;
    revenueTrend: number;
    totalPayments: number;
  };
  currency?: string;
  periodType?: 'month' | 'week' | 'year' | 'custom' | 'all';
}

// Memoized chart components for better performance
const RevenueProfitChart = memo(({ data, currency, totalRevenue, periodType }: { data: ChartData[]; currency?: string; totalRevenue: number; periodType?: 'month' | 'week' | 'year' | 'custom' | 'all' }) => {
  const xAxisInterval = data.length > 14 ? Math.max(0, Math.floor(data.length / 7)) : 0;
  
  // Calculate bar size based on period type and data length
  const calculateBarSize = () => {
    if (periodType === 'all') {
      // For "all", make bars thinner based on total days
      const totalDays = data.length;
      // More days = thinner bars, but keep minimum readable size
      return Math.max(2, Math.min(15, Math.floor(250 / Math.max(totalDays / 10, 1))));
    }
    // For other periods, use standard calculation
    return Math.max(15, Math.min(30, Math.floor(250 / Math.max(data.length, 1))));
  };
  
  const barSize = calculateBarSize();
  
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
        <XAxis 
          dataKey="date" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          tickMargin={8}
          interval={xAxisInterval}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          tickMargin={8}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return value.toString();
          }}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '10px',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          formatter={(value: unknown) => formatCurrency(Number(value ?? 0), currency)}
          labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }}
          iconType="square"
          iconSize={12}
        />
        <Bar 
          dataKey="revenue" 
          fill="#BFE7E5" 
          radius={[2, 2, 0, 0]}
          stroke="#9FD4D1"
          strokeWidth={0.5}
          name="Выручка"
          animationDuration={300}
          maxBarSize={barSize}
        />
        <Bar 
          dataKey="profit" 
          fill="#CFE6F2" 
          radius={[2, 2, 0, 0]}
          stroke="#A8D4E8"
          strokeWidth={0.5}
          name="Прибыль"
          animationDuration={300}
          maxBarSize={barSize}
        />
      </BarChart>
    </ResponsiveContainer>
  );
});

RevenueProfitChart.displayName = 'RevenueProfitChart';

const SalesBarChart = memo(({ data, periodType }: { data: ChartData[]; periodType?: 'month' | 'week' | 'year' | 'custom' | 'all' }) => {
  const xAxisInterval = data.length > 10 ? Math.max(0, Math.floor(data.length / 5)) : 0;
  
  // Calculate bar size based on period type and data length
  const calculateBarSize = () => {
    if (periodType === 'all') {
      // For "all", make bars thinner based on total days
      const totalDays = data.length;
      return Math.max(2, Math.min(15, Math.floor(200 / Math.max(totalDays / 10, 1))));
    }
    // For other periods, use standard calculation
    return Math.max(15, Math.min(30, Math.floor(200 / Math.max(data.length, 1))));
  };
  
  const barSize = calculateBarSize();
  
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
        <XAxis 
          dataKey="date" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={9}
          tickLine={false}
          angle={-45}
          textAnchor="end"
          height={70}
          interval={xAxisInterval}
        />
      <YAxis 
        stroke="hsl(var(--muted-foreground))"
        fontSize={10}
        tickLine={false}
      />
      <Tooltip 
        contentStyle={{
          backgroundColor: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
          padding: '6px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        formatter={(value: unknown) => [Number(value ?? 0), 'Продаж']}
      />
      <Bar 
        dataKey="salesCount" 
        name="Продаж"
        fill="#DED8F6" 
        radius={[2, 2, 0, 0]}
        stroke="#B8AED9"
        strokeWidth={0.5}
        animationDuration={300}
        maxBarSize={barSize}
      />
      </BarChart>
    </ResponsiveContainer>
  );
});

SalesBarChart.displayName = 'SalesBarChart';

const PaymentPieChart = memo(({ data, currency }: { data: PaymentData[]; currency?: string }) => (
  <ResponsiveContainer width="100%" height={200}>
    <RechartsPieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={({ name, percent }) => 
          (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''
        }
        outerRadius={70}
        fill="#8884d8"
        dataKey="value"
        fontSize={11}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        animationDuration={300}
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip 
        contentStyle={{
          backgroundColor: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
          padding: '6px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        formatter={(value: unknown) => formatCurrency(Number(value ?? 0), currency)}
      />
      <Legend 
        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
        iconType="circle"
        iconSize={10}
      />
    </RechartsPieChart>
  </ResponsiveContainer>
));

PaymentPieChart.displayName = 'PaymentPieChart';


const ReportsChartsSectionComponent = memo(({ chartData, paymentData, analytics, currency, periodType }: ReportsChartsSectionProps) => {
  return (
    <div className="px-5 mb-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1B2030] rounded-[16px] p-3 border border-white/10 border-l-4 border-l-primary/40">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Средняя выручка
          </p>
          <p className="font-mono-nums font-bold text-lg text-primary">
            {formatCurrency(analytics.avgRevenue, currency)}
          </p>
          {analytics.revenueTrend !== 0 && (
            <div className="flex items-center gap-1 mt-1">
              {analytics.revenueTrend > 0 ? (
                <TrendingUp size={12} className="text-success" />
              ) : (
                <TrendingDown size={12} className="text-destructive" />
              )}
              <span className={`text-[10px] ${analytics.revenueTrend > 0 ? 'text-success' : 'text-destructive'}`}>
                {analytics.revenueTrend > 0 ? '+' : ''}{analytics.revenueTrend.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div className="bg-[#1B2030] rounded-[16px] p-3 border border-white/10 border-l-4 border-l-success/40">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Средняя прибыль
          </p>
          <p className="font-mono-nums font-bold text-lg text-success">
            {formatCurrency(analytics.avgProfit, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {analytics.avgSales.toFixed(1)} продаж/день
          </p>
        </div>
      </div>

      {/* Revenue & Profit Chart */}
      <div className="bg-[#1B2030] rounded-[16px] p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LineChart size={20} className="text-primary" />
            <h3 className="font-bold text-base">Динамика выручки и прибыли</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Всего</p>
            <p className="font-mono-nums font-bold text-sm text-primary">
              {formatCurrency(analytics.totalRevenue, currency)}
            </p>
          </div>
        </div>
        <RevenueProfitChart data={chartData} currency={currency} totalRevenue={analytics.totalRevenue} periodType={periodType} />
      </div>

      {/* Sales Count & Payment Methods */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1B2030] rounded-[16px] p-4 border border-white/10 min-h-[280px]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-[#DED8F6]" />
            <h3 className="font-bold text-sm">Продаж в день</h3>
          </div>
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">Всего продаж</p>
            <p className="font-mono-nums font-bold text-lg text-[#DED8F6]">{analytics.totalSales}</p>
          </div>
          <div className="h-[200px] w-full">
            <SalesBarChart data={chartData} periodType={periodType} />
          </div>
        </div>

        {paymentData.length > 0 && (
          <div className="bg-[#1B2030] rounded-[16px] p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={18} className="text-[#F2D6DE]" />
              <h3 className="font-bold text-sm">Типы оплаты</h3>
            </div>
            <div className="mb-2">
              <p className="text-xs text-muted-foreground">Всего получено</p>
              <p className="font-mono-nums font-bold text-lg text-[#F2D6DE]">
                {formatCurrency(analytics.totalPayments, currency)}
              </p>
            </div>
            <PaymentPieChart data={paymentData} currency={currency} />
          </div>
        )}
      </div>
    </div>
  );
});

ReportsChartsSectionComponent.displayName = 'ReportsChartsSection';

// Default export for lazy loading
export default ReportsChartsSectionComponent;

// Named export for direct import
export const ReportsChartsSection = ReportsChartsSectionComponent;
