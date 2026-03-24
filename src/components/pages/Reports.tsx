'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  ChevronRight,
  Banknote,
  CreditCard,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  X,
  Plus,
  Minus,
  Check,
  ArrowLeft,
  ChevronDown,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { format, startOfDay, endOfDay, eachDayOfInterval, subDays, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

// Lazy load charts for better performance
const ReportsChartsSection = lazy(() => import('./ReportsCharts'));

interface DayReport {
  date: string;
  salesCount: number;
  revenue: number;
  cost: number;
  profit: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  cardBreakdown?: { cardKey: string; cardName: string; amount: number }[];
  discountTotal: number;
  lastSaleTime: string;
  lastSaleDescription: string;
  sales: any[];
}

export function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editPayment, setEditPayment] = useState<'cash' | 'card' | 'split' | 'debt'>('cash');
  const [editSplitCash, setEditSplitCash] = useState('');
  const [editSplitCard, setEditSplitCard] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDelivery, setEditDelivery] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editSaleDate, setEditSaleDate] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [periodType, setPeriodType] = useState<'month' | 'week' | 'year' | 'custom' | 'all'>('month');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showCharts, setShowCharts] = useState(false);

  // Calculate date range based on period type
  const calculatedDateRange = useMemo(() => {
    const today = new Date();
    let from: Date;
    let to: Date = endOfDay(today);

    switch (periodType) {
      case 'month':
        from = startOfDay(startOfMonth(today));
        break;
      case 'week':
        from = startOfDay(startOfWeek(today, { weekStartsOn: 1, locale: ru }));
        break;
      case 'year':
        from = startOfDay(startOfYear(today));
        break;
      case 'all':
        // Use a very old date to get all data
        from = startOfDay(new Date(2020, 0, 1));
        break;
      case 'custom':
        from = dateFrom ? startOfDay(dateFrom) : startOfDay(startOfMonth(today));
        to = dateTo ? endOfDay(dateTo) : endOfDay(today);
        break;
      default:
        from = startOfDay(startOfMonth(today));
    }

    return { from, to };
  }, [periodType, dateFrom, dateTo]);

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });
  const reportsFromStr = format(calculatedDateRange.from, 'yyyy-MM-dd');
  const reportsToStr = format(calculatedDateRange.to, 'yyyy-MM-dd');

  const {
    data,
    isLoading: reportsLoading,
    isError: reportsError,
    error: reportsErrorObj,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['reports', reportsFromStr, reportsToStr],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('from', reportsFromStr);
      params.set('to', reportsToStr);
      return api<{ dayReports: DayReport[] }>(`/api/reports?${params.toString()}`);
    },
  });
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () =>
      api<{
        flavors: any[];
        productFormats: any[];
        brands: any[];
        categories: any[];
      }>('/api/inventory'),
    enabled: Boolean(showReplaceModal),
  });

  const updateSaleMutation = useMutation({
    mutationFn: (payload: any) =>
      api(`/api/sales/${editingSale?.id}`, { method: 'PATCH', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setEditingSale(null);
      toast({ title: 'Продажа обновлена', description: 'Изменения сохранены' });
    },
    onError: (err: any) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось обновить продажу',
        variant: 'destructive',
      });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (saleId: string) =>
      api(`/api/sales/${saleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setDeleteConfirm(null);
      toast({ title: 'Продажа удалена', description: 'Товары возвращены на склад' });
    },
    onError: (err: any) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось удалить продажу',
        variant: 'destructive',
      });
    },
  });

  const dayReports = data?.dayReports ?? [];
  const selectedReport = useMemo(
    () => dayReports.find((r) => r.date === selectedDate),
    [dayReports, selectedDate]
  );
  const daySales = selectedReport?.sales ?? [];

  // Function to fill gaps in data with zero values
  const fillDateGaps = useMemo(() => {
    if (dayReports.length === 0) return [];
    
    // Use calculated date range for charts
    // For custom period, use selected dates; for others, use period boundaries
    let startDate: Date;
    let endDate: Date = endOfDay(new Date());
    
    if (periodType === 'custom') {
      // Если даты ещё не выбраны — совпадаем с API (calculatedDateRange), иначе графики = [] и ломается Recharts
      if (dateFrom && dateTo) {
        startDate = startOfDay(dateFrom);
        endDate = endOfDay(dateTo);
      } else {
        startDate = calculatedDateRange.from;
        endDate = calculatedDateRange.to;
      }
    } else if (periodType === 'all') {
      // For "all", use first sale date to today (shop existence period)
      const sortedReports = [...dayReports].sort((a, b) => a.date.localeCompare(b.date));
      const firstSaleDate = sortedReports[0]?.date;
      if (!firstSaleDate) return [];
      startDate = startOfDay(new Date(firstSaleDate));
      endDate = endOfDay(new Date());
    } else {
      // For month/week/year, use period boundaries
      startDate = calculatedDateRange.from;
      endDate = calculatedDateRange.to;
    }
    
    // Create map of existing data by date string
    const dataMap = new Map<string, typeof dayReports[0]>();
    dayReports.forEach(day => {
      dataMap.set(day.date, day);
    });
    
    // Generate all days in range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Fill gaps with zero values
    return allDays.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existingData = dataMap.get(dateStr);
      
      return {
        date: format(date, 'dd.MM', { locale: ru }),
        fullDate: dateStr,
        revenue: existingData?.revenue ?? 0,
        profit: existingData?.profit ?? 0,
        salesCount: existingData?.salesCount ?? 0,
        cost: existingData?.cost ?? 0,
      };
    });
  }, [dayReports, periodType, dateFrom, dateTo, calculatedDateRange]);

  // Memoized chart data preparation
  const chartData = useMemo(() => fillDateGaps, [fillDateGaps]);

  // Memoized analytics calculations
  const analytics = useMemo(() => {
    const totalRevenue = dayReports.reduce((sum, day) => sum + day.revenue, 0);
    const totalProfit = dayReports.reduce((sum, day) => sum + day.profit, 0);
    const totalSales = dayReports.reduce((sum, day) => sum + day.salesCount, 0);
    const avgRevenue = dayReports.length > 0 ? totalRevenue / dayReports.length : 0;
    const avgProfit = dayReports.length > 0 ? totalProfit / dayReports.length : 0;
    const avgSales = dayReports.length > 0 ? totalSales / dayReports.length : 0;
    
    // Calculate trend (comparing first half vs second half)
    const midPoint = Math.floor(dayReports.length / 2);
    const firstHalfRevenue = dayReports.slice(0, midPoint).reduce((sum, day) => sum + day.revenue, 0);
    const secondHalfRevenue = dayReports.slice(midPoint).reduce((sum, day) => sum + day.revenue, 0);
    const revenueTrend = midPoint > 0 && firstHalfRevenue > 0 
      ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
      : 0;

    const totalCash = dayReports.reduce((sum, day) => sum + day.cashAmount, 0);
    const totalCard = dayReports.reduce((sum, day) => sum + day.cardAmount, 0);
    const totalDebt = dayReports.reduce((sum, day) => sum + day.debtAmount, 0);
    const totalPayments = totalCash + totalCard + totalDebt;

    return {
      totalRevenue,
      totalProfit,
      totalSales,
      avgRevenue,
      avgProfit,
      avgSales,
      revenueTrend,
      totalPayments,
    };
  }, [dayReports]);

  // Memoized payment data
  const paymentData = useMemo(() => {
    const totalCash = dayReports.reduce((sum, day) => sum + day.cashAmount, 0);
    const totalCard = dayReports.reduce((sum, day) => sum + day.cardAmount, 0);
    const totalDebt = dayReports.reduce((sum, day) => sum + day.debtAmount, 0);
    return [
      { name: 'Наличные', value: totalCash, color: '#BFE7E5' },
      { name: 'Карта', value: totalCard, color: '#CFE6F2' },
      { name: 'В долг', value: totalDebt, color: '#F2D6DE' },
    ].filter((item) => item.value > 0);
  }, [dayReports]);

  const openEdit = (sale: any) => {
    setEditingSale(sale);
    setEditItems(sale.items.map((i: any) => ({ ...i })));
    const pt = sale.paymentType === 'split' || sale.paymentType === 'cash' || sale.paymentType === 'card' || sale.paymentType === 'debt' ? sale.paymentType : 'cash';
    setEditPayment(pt);
    setEditSplitCash(pt === 'split' && sale.cashAmount != null ? String(sale.cashAmount) : '');
    setEditSplitCard(pt === 'split' && sale.cardAmount != null ? String(sale.cardAmount) : '');
    setEditDiscount(sale.discountValue > 0 ? String(sale.discountValue) : '');
    setEditDelivery(
      sale.deliveryAmount != null && Number(sale.deliveryAmount) > 0
        ? String(sale.deliveryAmount)
        : ''
    );
    setEditCustomer(sale.customerName || '');
    setEditComment(sale.comment || '');
    setEditSaleDate(sale.saleDate ? format(new Date(sale.saleDate), "yyyy-MM-dd'T'HH:mm") : '');
  };

  const updateEditItemQty = (itemId: string, delta: number) => {
    setEditItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity: Math.max(1, i.quantity + delta),
              lineTotal: Math.max(1, i.quantity + delta) * i.unitPrice,
            }
          : i
      )
    );
  };

  const removeEditItem = (itemId: string) => {
    setEditItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const replaceItem = (oldItemId: string | null, newFlavorId: string) => {
    const flavors = Array.isArray(inventoryData?.flavors) ? inventoryData.flavors : [];
    const productFormats = Array.isArray(inventoryData?.productFormats) ? inventoryData.productFormats : [];
    const brands = Array.isArray(inventoryData?.brands) ? inventoryData.brands : [];
    
    const newFlavor = flavors.find((f: any) => f.id === newFlavorId);
    if (!newFlavor) return;
    
    const format = productFormats.find((pf: any) => pf.id === newFlavor.productFormatId);
    const brand = brands.find((b: any) => b.id === format?.brandId);
    
    if (!format || !brand) return;
    
    if (oldItemId === 'new') {
      // Добавляем новый товар
      const newItem = {
        id: `temp-${Date.now()}`,
        flavorId: newFlavorId,
        productNameSnapshot: `${brand.name} ${format.name}`,
        flavorNameSnapshot: newFlavor.name,
        unitPrice: format.unitPrice,
        quantity: 1,
        lineTotal: format.unitPrice,
      };
      setEditItems((prev) => [...prev, newItem]);
    } else {
      // Заменяем существующий товар
      const oldItem = editItems.find((i) => i.id === oldItemId);
      if (!oldItem) return;
      
      setEditItems((prev) =>
        prev.map((i) =>
          i.id === oldItemId
            ? {
                ...i,
                flavorId: newFlavorId,
                productNameSnapshot: `${brand.name} ${format.name}`,
                flavorNameSnapshot: newFlavor.name,
                unitPrice: format.unitPrice,
                lineTotal: oldItem.quantity * format.unitPrice,
              }
            : i
        )
      );
    }
    setShowReplaceModal(false);
    setReplacingItemId(null);
  };

  const saveEdit = () => {
    if (!editingSale || editItems.length === 0) return;
    const editSubtotal = editItems.reduce((s, i) => s + i.lineTotal, 0);
    const editDiscountAmount = editDiscount ? parseFloat(editDiscount) || 0 : 0;
    const editDeliveryAmount = Math.max(0, editDelivery ? parseFloat(editDelivery) || 0 : 0);
    const editTotal = Math.max(0, editSubtotal - editDiscountAmount + editDeliveryAmount);

    const payload: any = {
      items: editItems.map((i) => ({
        flavorId: i.flavorId,
        productNameSnapshot: i.productNameSnapshot,
        flavorNameSnapshot: i.flavorNameSnapshot,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      paymentType: editPayment,
      discountValue: editDiscountAmount,
      discountType: 'absolute',
      deliveryAmount: editDeliveryAmount,
      customerName: editPayment === 'debt' ? editCustomer : null,
      comment: editComment || null,
    };
    if (editPayment === 'split') {
      const cash = parseFloat(editSplitCash) || 0;
      const card = parseFloat(editSplitCard) || 0;
      if (Math.abs(cash + card - editTotal) > 0.01) return;
      payload.cashAmount = cash;
      payload.cardAmount = card;
    }
    if (editSaleDate && editSaleDate.trim()) {
      payload.saleDate = editSaleDate;
    }
    updateSaleMutation.mutate(payload);
  };

  const deleteSale = (saleId: string) => {
    deleteSaleMutation.mutate(saleId);
  };

  const paymentIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <Banknote size={12} className="text-success" />;
      case 'card':
        return <CreditCard size={12} className="text-primary" />;
      case 'split':
        return <Wallet size={12} className="text-primary" />;
      case 'debt':
        return <Clock size={12} className="text-warning" />;
      default:
        return null;
    }
  };

  return (
    <>
      <ScreenHeader
        title="Отчёты"
        subtitle="История продаж по дням"
        actions={
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft size={16} />
            </Button>
          </Link>
        }
      />
      
      <div className="px-5 mb-4">
        <div className="bg-[#1B2030] rounded-[16px] p-4 border border-white/10 space-y-3">
          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider block">
            Период отчёта
          </label>
          
          {/* Period type selector */}
          <div className="grid grid-cols-5 gap-2">
            {(['all', 'week', 'month', 'year', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setPeriodType(type);
                  if (type !== 'custom') {
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }
                }}
                className={`py-2.5 px-1 min-w-0 rounded-[12px] text-xs font-semibold transition-all active:scale-[0.98] truncate ${
                  periodType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[#151922]/60 text-[#9CA3AF] hover:bg-[#151922]/90'
                }`}
                title={type === 'custom' ? 'Произвольный период' : undefined}
              >
                {type === 'month' ? 'Месяц' : 
                 type === 'week' ? 'Неделя' : 
                 type === 'year' ? 'Год' : 
                 type === 'all' ? 'Всё' : 
                 'Свой'}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {periodType === 'custom' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">От</label>
                <DatePicker
                  date={dateFrom}
                  setDate={setDateFrom}
                  placeholder="Выберите дату"
                  disabled={(date) => (dateTo ? date > dateTo : date > new Date())}
                />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">До</label>
                <DatePicker
                  date={dateTo}
                  setDate={setDateTo}
                  placeholder="Выберите дату"
                  disabled={(date) => (dateFrom ? date < dateFrom : false) || date > new Date()}
                />
              </div>
            </div>
          )}

          {/* Period info */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-[#9CA3AF]">
              Период: {format(calculatedDateRange.from, 'dd.MM.yyyy', { locale: ru })} - {format(calculatedDateRange.to, 'dd.MM.yyyy', { locale: ru })}
            </span>
          </div>
        </div>
      </div>

      {reportsLoading && (
        <div className="px-5 py-10 flex flex-col items-center gap-3 text-[#9CA3AF]">
          <Loader2 className="h-8 w-8 animate-spin text-[#BFE7E5]" aria-hidden />
          <p className="text-sm">Загружаем отчёты…</p>
        </div>
      )}

      {reportsError && !reportsLoading && (
        <div className="px-5 mb-4">
          <div className="rounded-[16px] border border-red-500/35 bg-red-500/10 p-4 text-sm">
            <p className="font-medium text-[#F5F5F7] mb-2">Не удалось загрузить отчёты</p>
            <p className="text-xs text-[#9CA3AF] mb-3">
              {(reportsErrorObj as Error)?.message || 'Проверьте сеть или войдите снова.'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchReports()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
          </div>
        </div>
      )}

      {!reportsLoading && !reportsError && dayReports.length === 0 && (
        <div className="px-5 py-10 text-center">
          <p className="text-[#F5F5F7] font-medium mb-1">Нет продаж за выбранный период</p>
          <p className="text-sm text-[#9CA3AF] max-w-sm mx-auto">
            Смените период выше или оформите продажи в разделе «Продажа».
          </p>
        </div>
      )}

      {/* Charts Toggle Button */}
      {!reportsLoading && !reportsError && dayReports.length > 0 && (
        <div className="px-5 mb-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCharts(!showCharts)}
            className="w-full bg-[#1B2030] rounded-[16px] border border-white/10 p-4 flex items-center justify-between hover:bg-[#252b3a] transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[#BFE7E5]" />
              <span className="font-semibold text-sm text-[#F5F5F7]">Аналитика и графики</span>
            </div>
            <ChevronDown
              size={16}
              className={`text-[#9CA3AF] transition-transform ${
                showCharts ? 'rotate-180' : ''
              }`}
            />
          </motion.button>
        </div>
      )}

      {/* Charts Section - fixed height ensures ResponsiveContainer renders correctly */}
      <AnimatePresence>
        {!reportsLoading && !reportsError && showCharts && dayReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <div className="min-h-[700px]">
              <Suspense fallback={
                <div className="px-5 mb-4">
                  <div className="bg-[#1B2030] rounded-[16px] border border-white/10 p-4">
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-[#BFE7E5]" />
                    </div>
                  </div>
                </div>
              }>
                <ReportsChartsSection
                  chartData={chartData}
                  paymentData={paymentData}
                  analytics={analytics}
                  currency={shopData?.currency}
                  periodType={periodType}
                />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 space-y-3 pb-4">
        {!reportsLoading && !reportsError && dayReports.map((day) => {
          const isSelected = selectedDate === day.date;
          return (
            <div key={day.date}>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setSelectedDate(isSelected ? null : day.date)
                }
                className={`w-full bg-[#1B2030] rounded-[16px] border p-4 text-left transition-all ${
                  isSelected ? 'border-[#BFE7E5]/40' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-[#F5F5F7]">
                      {format(new Date(day.date), 'EEEE, d MMMM', { locale: ru })}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {day.salesCount} продаж • последняя в {day.lastSaleTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                       <p className="font-mono-nums font-bold text-[#BFE7E5]">
                        {formatCurrency(day.revenue, shopData?.currency)}
                      </p>
                      <p className="text-[10px] text-[#86EFAC] font-medium">
                        +{day.profit} приб.
                      </p>
                    </div>
                    <ChevronRight
                      size={14}
                      className={`text-muted-foreground transition-transform ${
                        isSelected ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {day.cashAmount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Banknote size={10} className="text-success" />{' '}
                      {formatCurrency(day.cashAmount, shopData?.currency)}
                    </span>
                  )}
                  {day.cardAmount > 0 && (day.cardBreakdown?.length ?? 0) > 0 ? (
                    day.cardBreakdown!.map((cb) => (
                      <span key={cb.cardKey} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CreditCard size={10} className="text-primary" />{' '}
                        {cb.cardName}: {formatCurrency(cb.amount, shopData?.currency)}
                      </span>
                    ))
                  ) : day.cardAmount > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CreditCard size={10} className="text-primary" />{' '}
                      {formatCurrency(day.cardAmount, shopData?.currency)}
                    </span>
                  ) : null}
                  {day.debtAmount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={10} className="text-warning" />{' '}
                      {formatCurrency(day.debtAmount, shopData?.currency)}
                    </span>
                  )}
                  {day.discountTotal > 0 && (
                    <span className="text-xs text-destructive">
                      −{formatCurrency(day.discountTotal, shopData?.currency)} скидки
                    </span>
                  )}
                </div>
              </motion.button>

              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    {selectedReport && (
                      <div className="bg-[#1B2030] rounded-[16px] border border-white/10 p-3 mt-2 grid grid-cols-3 gap-2">
                        <div className="text-center p-2 border-r border-border/50">
                          <p className="font-mono-nums font-bold text-primary">
                            {formatCurrency(selectedReport.revenue, shopData?.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            Выручка
                          </p>
                        </div>
                        <div className="text-center p-2 border-r border-border/50">
                          <p className="font-mono-nums font-bold text-success">
                            {formatCurrency(selectedReport.profit, shopData?.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            Прибыль
                          </p>
                        </div>
                        <div className="text-center p-2">
                          <p className="font-mono-nums font-bold text-muted-foreground">
                            {formatCurrency(selectedReport.cost, shopData?.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            Себест.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mt-2">
                      {daySales.length > 0 ? (
                        daySales.map((sale: any) => (
                          <div
                            key={sale.id}
                            className={`rounded-[16px] border p-3 bg-[#1B2030] ${
                              sale.status === 'edited'
                                ? 'border-warning/40'
                                : sale.isReservation
                                  ? 'border-primary/35'
                                  : 'border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {paymentIcon(sale.paymentType)}
                                <span className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(sale.datetime),
                                    'HH:mm',
                                    { locale: ru }
                                  )}
                                </span>
                                {sale.status === 'edited' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                                    ред.
                                  </span>
                                )}
                                {sale.isReservation && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                    резерв
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEdit(sale)}
                                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(sale.id)}
                                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 size={12} />
                                </button>
                                <div className="text-right">
                                  <span className="font-mono-nums font-semibold text-sm block">
                                    {formatCurrency(sale.finalAmount, shopData?.currency)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Приб: {sale.calculatedProfit}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {sale.isReservation && (sale.reservationCustomerName || sale.reservationExpiry) && (
                              <div className="mb-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                                {sale.reservationCustomerName && (
                                  <p className="text-xs text-primary font-medium mb-1">
                                    Клиент: {sale.reservationCustomerName}
                                  </p>
                                )}
                                {sale.reservationExpiry && (
                                  <p className="text-xs text-muted-foreground">
                                    До: {format(new Date(sale.reservationExpiry), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                  </p>
                                )}
                              </div>
                            )}
                            <div className="space-y-1">
                              {(sale.items ?? []).map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-foreground/80">
                                    {item.quantity}×{item.flavorNameSnapshot}
                                  </span>
                                  <span className="font-mono-nums text-xs">
                                    {formatCurrency(item.lineTotal, shopData?.currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="border-t border-border mt-2 pt-2 flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
                              {sale.discountValue > 0 && (
                                <span className="text-xs text-destructive">
                                  −{formatCurrency(sale.discountValue, shopData?.currency)} скидка
                                </span>
                              )}
                              {(sale.deliveryAmount ?? 0) > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Доставка: {formatCurrency(sale.deliveryAmount, shopData?.currency)}
                                </span>
                              )}
                              {sale.customerName && (
                                <span className="text-xs text-warning">
                                  Долг: {sale.customerName}
                                </span>
                              )}
                              {sale.comment && (
                                <span className="text-xs text-muted-foreground">
                                  {sale.comment}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Нет данных за этот день
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Edit Sale Dialog */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать продажу</DialogTitle>
            <DialogDescription>Измените детали продажи</DialogDescription>
          </DialogHeader>
          {editingSale && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Дата продажи
                </label>
                <Input
                  type="datetime-local"
                  value={editSaleDate}
                  onChange={(e) => setEditSaleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Способ оплаты
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'cash' as const, icon: Banknote, label: 'Наличка' },
                    { value: 'card' as const, icon: CreditCard, label: 'Карта' },
                    { value: 'split' as const, icon: Wallet, label: 'Сплит' },
                    { value: 'debt' as const, icon: Clock, label: 'В долг' },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setEditPayment(opt.value)}
                        className={`flex-1 flex items-center gap-2 p-2 rounded-lg border transition-all ${
                          editPayment === opt.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border'
                        }`}
                      >
                        <Icon size={14} />
                        <span className="text-xs">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {editPayment === 'split' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Наличные</label>
                    <Input
                      type="number"
                      value={editSplitCash}
                      onChange={(e) => setEditSplitCash(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Карта</label>
                    <Input
                      type="number"
                      value={editSplitCard}
                      onChange={(e) => setEditSplitCard(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
              {editPayment === 'debt' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Имя клиента
                  </label>
                  <Input
                    value={editCustomer}
                    onChange={(e) => setEditCustomer(e.target.value)}
                    placeholder="Введите имя"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Товары
                </label>
                <div className="space-y-2">
                  {editItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 border border-border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm">{item.flavorNameSnapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.unitPrice} {getCurrencySymbol(shopData?.currency)} × {item.quantity} = {item.lineTotal} {getCurrencySymbol(shopData?.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateEditItemQty(item.id, -1)}
                          className="w-6 h-6 rounded bg-secondary flex items-center justify-center"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateEditItemQty(item.id, 1)}
                          className="w-6 h-6 rounded bg-secondary flex items-center justify-center"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setReplacingItemId(item.id);
                            setShowReplaceModal(true);
                          }}
                          className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center"
                          title="Заменить товар"
                        >
                          <RefreshCw size={12} />
                        </button>
                        <button
                          onClick={() => removeEditItem(item.id)}
                          className="w-6 h-6 rounded bg-destructive/10 text-destructive flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReplacingItemId('new');
                      setShowReplaceModal(true);
                    }}
                    className="w-full mt-2"
                  >
                    <Plus size={14} className="mr-2" />
                    Добавить товар
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Скидка
                </label>
                <Input
                  type="number"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                  placeholder="0"
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Доставка
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editDelivery}
                  onChange={(e) => setEditDelivery(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Комментарий
                </label>
                <Textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                  rows={2}
                />
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                {(editDelivery ? parseFloat(editDelivery) || 0 : 0) > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Доставка</span>
                    <span className="font-mono-nums">
                      {formatCurrency(
                        Math.max(0, editDelivery ? parseFloat(editDelivery) || 0 : 0),
                        shopData?.currency
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Итого:</span>
                  <span className="font-mono-nums font-bold">
                    {formatCurrency(
                      Math.max(
                        0,
                        editItems.reduce((s, i) => s + i.lineTotal, 0) -
                          (editDiscount ? parseFloat(editDiscount) || 0 : 0) +
                          Math.max(0, editDelivery ? parseFloat(editDelivery) || 0 : 0)
                      ),
                      shopData?.currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSale(null)}>
              Отмена
            </Button>
            <Button onClick={saveEdit} disabled={updateSaleMutation.isPending}>
              {updateSaleMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить продажу?</DialogTitle>
            <DialogDescription>
              Товары будут возвращены на склад. Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteSale(deleteConfirm)}
              disabled={deleteSaleMutation.isPending}
            >
              {deleteSaleMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Item Modal */}
      <Dialog
        open={showReplaceModal}
        onOpenChange={(open) => {
          setShowReplaceModal(open);
          if (!open) {
            setReplacingItemId(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>
              {replacingItemId === 'new' ? 'Добавить товар' : 'Заменить товар'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ReplaceItemCatalogView
              inventory={inventoryData}
              onSelect={(flavorId) => replaceItem(replacingItemId, flavorId)}
            />
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}

// Catalog View for replacing items
function ReplaceItemCatalogView({
  inventory,
  onSelect,
}: {
  inventory: any;
  onSelect: (flavorId: string) => void;
}) {
  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });
  const [path, setPath] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const categories = Array.isArray(inventory?.categories) ? inventory.categories : [];
  const brands = Array.isArray(inventory?.brands) ? inventory.brands : [];
  const productFormats = Array.isArray(inventory?.productFormats) ? inventory.productFormats : [];
  const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];

  const currentLevel = path.length;

  const handleBack = () => setPath((prev) => prev.slice(0, -1));

  const items = () => {
    if (currentLevel === 0) return categories;
    if (currentLevel === 1) return brands.filter((b: any) => b.categoryId === path[0]?.id);
    if (currentLevel === 2) return productFormats.filter((f: any) => f.brandId === path[1]?.id);
    if (currentLevel === 3) {
      const formatId = path[2]?.id;
      return flavors.filter((f: any) => f.productFormatId === formatId && f.quantity > 0);
    }
    return [];
  };

  const handleSelect = (item: any) => {
    if (currentLevel === 3) {
      onSelect(item.id);
    } else {
      setPath((prev) => [...prev, item]);
    }
  };

  // Search functionality
  const searchResults =
    search.length >= 2
      ? flavors
          .filter((f: any) => {
            const format = productFormats.find((pf: any) => pf.id === f.productFormatId);
            const brand = format ? brands.find((b: any) => b.id === format.brandId) : null;
            const combined = `${brand?.name || ''} ${format?.name || ''} ${f.name}`.toLowerCase();
            return combined.includes(search.toLowerCase()) && f.quantity > 0;
          })
          .slice(0, 10)
      : [];

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск товара..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border rounded-xl overflow-hidden bg-background max-h-40 overflow-y-auto">
            {searchResults.map((f: any) => {
              const format = productFormats.find((pf: any) => pf.id === f.productFormatId);
              const brand = format ? brands.find((b: any) => b.id === format.brandId) : null;
              return (
                <button
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  className="w-full text-left p-2 hover:bg-secondary flex justify-between items-center border-b last:border-0"
                >
                  <div>
                    <p className="text-sm">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {brand?.emojiPrefix} {format?.name}
                    </p>
                  </div>
                  <span className="text-xs text-primary font-medium">
                    {formatCurrency(format?.unitPrice || 0, shopData?.currency)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      {currentLevel > 0 && (
        <div className="flex items-center gap-2 p-2 border-b bg-background/50">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
          <div className="flex gap-1 text-sm text-muted-foreground overflow-hidden">
            {path.map((p, i) => (
              <span key={i} className="flex items-center">
                {p.name} {i < path.length - 1 && <ChevronRight size={12} />}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-2">
        {items().map((item: any) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center justify-between p-3 border-b last:border-0 hover:bg-secondary/50 text-left transition-colors"
          >
            <div className="flex items-center gap-2 flex-1">
              {item.emoji && <span>{item.emoji}</span>}
              {item.emojiPrefix && <span>{item.emojiPrefix}</span>}
              <span className="text-sm">{item.name}</span>
              {currentLevel === 3 && (
                <span className="text-xs text-muted-foreground">({item.quantity} шт)</span>
              )}
              {currentLevel === 2 && (
                <span className="text-xs text-primary font-medium ml-auto">
                  {formatCurrency(item.unitPrice || 0, shopData?.currency)}
                </span>
              )}
            </div>
            {currentLevel === 3 ? (
              <Check size={16} className="text-primary ml-2" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground ml-2" />
            )}
          </button>
        ))}
        {items().length === 0 && (
          <div className="text-center p-4 text-muted-foreground text-sm">Пусто</div>
        )}
      </div>
    </div>
  );
}
