'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KPICard, CARD_COLORS } from '@/components/KPICard';
import { KPISkeleton } from '@/components/KPISkeleton';
import { HourlyChartCard } from '@/components/HourlyChartCard';
import { ShoppingCart, Package, FileText, Users, TrendingUp, CreditCard, PackagePlus, Settings, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { ReceiveModal } from '@/components/inventory/ReceiveModal';
import type { ReportsResponse, DebtsResponse, ReservesResponse, InventoryResponse } from '@/types/api';

export function Dashboard() {
  const [showReceive, setShowReceive] = useState(false);
  const router = useRouter();

  const { data: userData } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => api<{ firstName: string | null }>('/api/user/me'),
  });
  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ name: string; address: string | null; currency: string }>('/api/shop'),
  });
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['reports', 7],
    queryFn: () => api<ReportsResponse>('/api/reports?days=7'),
  });
  const { data: debtsData } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api<DebtsResponse>('/api/debts'),
  });
  const { data: reservesData } = useQuery({
    queryKey: ['reserves'],
    queryFn: () => api<ReservesResponse>('/api/reserves'),
  });
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<InventoryResponse>('/api/inventory'),
  });

  const dayReports = reportsData?.dayReports ?? [];
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = dayReports.find((d) => d.date === todayStr) ?? {
    date: todayStr,
    salesCount: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    cashAmount: 0,
    cardAmount: 0,
    debtAmount: 0,
    discountTotal: 0,
    reservationsCount: 0,
    reservationsAmount: 0,
    lastSaleTime: '—',
    lastSaleDescription: '—',
    sales: [],
  };
  const totalDebt =
    debtsData?.reduce((s: number, d: { totalDebt: number }) => s + d.totalDebt, 0) ?? 0;
  const topDebts = debtsData?.slice(0, 3) ?? [];
  const topReserves = reservesData?.slice(0, 3) ?? [];
  const totalStock =
    inventoryData?.items && Array.isArray(inventoryData.items)
      ? inventoryData.items.reduce((s, f) => s + (f.quantity ?? 0), 0)
      : 0;

  const currency = shopData?.currency || 'BYN';

  const hourlyData = (() => {
    const sales = today.sales ?? [];
    const byHour = new Map<number, { receipts: number; items: number }>();
    for (let h = 0; h < 24; h++) {
      byHour.set(h, { receipts: 0, items: 0 });
    }
    for (const sale of sales) {
      if (sale.isReservation) continue;
      const hour = new Date(sale.datetime).getHours();
      const entry = byHour.get(hour)!;
      entry.receipts += 1;
      entry.items += (sale.items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0);
    }
    return Array.from(byHour.entries()).map(([h, v]) => ({
      hour: `${h.toString().padStart(2, '0')}:00`,
      receipts: v.receipts,
      items: v.items,
    }));
  })();

  const todayValue =
    today.revenue >= 1000 ? `${Math.floor(today.revenue / 1000)}k` : String(today.revenue);
  const debtValue =
    totalDebt >= 1000 ? `${Math.floor(totalDebt / 1000)}k` : String(totalDebt);

  return (
    <>
      <ScreenHeader
        title={userData?.firstName ? 'С возвращением!' : 'Главная'}
        greeting={userData?.firstName ? `Привет, ${userData.firstName}` : undefined}
        subtitle={
          !userData?.firstName && shopData?.name
            ? `${shopData.name}${shopData.address ? ` • ${shopData.address}` : ''}`
            : undefined
        }
        actions={
          <div className="flex gap-2">
            <Link
              href="/settings"
              className="p-2.5 hover:bg-muted rounded-full transition-colors"
              aria-label="Настройки"
            >
              <Settings size={22} className="text-muted-foreground" strokeWidth={1.5} />
            </Link>
          </div>
        }
      />

      <div className="pb-6 px-5">
        {reportsLoading ? (
          <KPISkeleton />
        ) : (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-4">
              <KPICard
                title="Сегодня"
                value={todayValue}
                subtitle={currency}
                icon={TrendingUp}
                color="mint"
                delay={0.1}
              />
              <KPICard
                title="Долги"
                value={debtValue}
                subtitle={currency}
                icon={CreditCard}
                color="mint"
                delay={0.2}
                onClick={() => router.push('/profile')}
              />
              <KPICard
                title="Склад"
                value={String(totalStock)}
                subtitle="шт"
                icon={Package}
                color="periwinkle"
                delay={0.3}
              />
              <KPICard
                title="Резервы"
                value={String(reservesData?.length ?? 0)}
                subtitle="шт"
                icon={PackagePlus}
                color="periwinkle"
                delay={0.35}
                onClick={() => router.push('/profile')}
              />
            </div>
          </section>
        )}

        <section className="mb-6">
          <h3 className="text-[#F5F5F7] mb-4 text-sm font-semibold tracking-tight">
            Быстрые действия
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              onClick={() => router.push('/sales')}
              className="rounded-[24px] p-5 text-left active:scale-[0.97] transition-transform"
              style={{ background: CARD_COLORS.mint.gradient, boxShadow: CARD_COLORS.mint.shadow }}
            >
              <div className="p-3 bg-[#0F1115] rounded-[14px] w-fit mb-3">
                <ShoppingCart size={24} style={{ color: CARD_COLORS.mint.iconColor }} strokeWidth={1.5} />
              </div>
              <h4 className="text-[#111111] font-bold text-base mb-1">
                Новая продажа
              </h4>
              <p className="text-[#1A1A1A] text-xs opacity-80">Быстрое оформление</p>
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 }}
              onClick={() => setShowReceive(true)}
              className="rounded-[24px] p-5 text-left active:scale-[0.97] transition-transform"
              style={{ background: CARD_COLORS.mint.gradient, boxShadow: CARD_COLORS.mint.shadow }}
            >
              <div className="p-3 bg-[#0F1115] rounded-[14px] w-fit mb-3">
                <Package size={24} style={{ color: CARD_COLORS.mint.iconColor }} strokeWidth={1.5} />
              </div>
              <h4 className="text-[#111111] font-bold text-base mb-1">Принять товар</h4>
              <p className="text-[#1A1A1A] text-xs">Приёмка на склад</p>
            </motion.button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
            className="grid grid-cols-3 gap-4"
          >
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.2 }}
              onClick={() => router.push('/inventory')}
              className="rounded-[24px] p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: CARD_COLORS.periwinkle.gradient, boxShadow: CARD_COLORS.periwinkle.shadow }}
            >
              <div className="p-2.5 bg-[#0F1115] rounded-[12px]">
                <Package size={20} style={{ color: CARD_COLORS.periwinkle.iconColor }} strokeWidth={1.5} />
              </div>
              <span className="text-[#111111] text-xs font-semibold">Склад</span>
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.22 }}
              onClick={() => router.push('/post')}
              className="rounded-[24px] p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: CARD_COLORS.periwinkle.gradient, boxShadow: CARD_COLORS.periwinkle.shadow }}
            >
              <div className="p-2.5 bg-[#0F1115] rounded-[12px]">
                <FileText size={20} style={{ color: CARD_COLORS.periwinkle.iconColor }} strokeWidth={1.5} />
              </div>
              <span className="text-[#111111] text-xs font-semibold">Пост</span>
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.24 }}
              onClick={() => router.push('/profile')}
              className="rounded-[24px] p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: CARD_COLORS.periwinkle.gradient, boxShadow: CARD_COLORS.periwinkle.shadow }}
            >
              <div className="p-2.5 bg-[#0F1115] rounded-[12px]">
                <Users size={20} style={{ color: CARD_COLORS.periwinkle.iconColor }} strokeWidth={1.5} />
              </div>
              <span className="text-[#111111] text-xs font-semibold">Профиль</span>
            </motion.button>
          </motion.div>
        </section>

        <section className="mb-6">
          <h3 className="text-[#F5F5F7] mb-4 text-sm font-semibold tracking-tight">
            Сводка за сегодня
          </h3>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.3 }}
            className="bg-[#1E2329]/90 backdrop-blur-sm rounded-[24px] p-5 border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
          >
            <div className="space-y-3">
              {[
                { label: 'Продаж', value: `${today.salesCount} шт` },
                { label: 'Наличка', value: `${(today.cashAmount ?? 0).toLocaleString()}₽` },
                { label: 'Карта', value: `${(today.cardAmount ?? 0).toLocaleString()}₽` },
                { label: 'В долг', value: `${(today.debtAmount ?? 0).toLocaleString()}₽` },
                { label: 'Резервы', value: `${today.reservationsCount ?? 0} шт` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] text-sm">{item.label}</span>
                  <span className="text-[#F5F5F7] font-semibold">{item.value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[#F5F5F7] font-semibold">Итого</span>
                <span className="text-[#BFE7E5] font-bold text-lg">
                  {(today.revenue ?? 0).toLocaleString()}₽
                </span>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mb-6">
          <HourlyChartCard data={hourlyData} delay={0.4} />
        </section>

        {topDebts.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#F5F5F7] text-sm font-semibold tracking-tight">
                Долги
              </h3>
              <button
                onClick={() => router.push('/profile')}
                className="text-[#BFE7E5] text-xs active:scale-95 transition-transform"
              >
                Все долги
              </button>
            </div>
            <div className="space-y-3">
              {topDebts.map((debt: { id: string; customerName: string; totalDebt: number; updatedAt?: string }, index: number) => (
                <motion.button
                  key={debt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.5 + index * 0.1 }}
                  onClick={() => router.push('/profile')}
                  className="w-full bg-[#1E2329] rounded-[20px] p-4 flex items-center justify-between active:scale-[0.98] transition-transform border border-white/5"
                >
                  <div className="text-left">
                    <h4 className="text-[#F5F5F7] font-semibold mb-1">{debt.customerName}</h4>
                    <p className="text-xs text-[#9CA3AF]">
                      {debt.updatedAt
                        ? format(new Date(debt.updatedAt), 'd MMM', { locale: ru })
                        : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#F2D6DE] font-bold text-lg">
                      {formatCurrency(debt.totalDebt, currency)}
                    </span>
                    <ChevronRight size={18} className="text-[#6B7280]" strokeWidth={1.5} />
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {topReserves.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#F5F5F7] text-sm font-semibold tracking-tight">
                Резервы
              </h3>
              <button
                onClick={() => router.push('/profile')}
                className="text-[#BFE7E5] text-xs active:scale-95 transition-transform"
              >
                Все резервы
              </button>
            </div>
            <div className="space-y-3">
              {topReserves.map((reserve: { id: string; reservationCustomerName: string | null; reservationExpiry: string | null; finalAmount: number }, index: number) => {
                const formatExpiry = (dateStr: string | null) => {
                  if (!dateStr) return { text: '—', color: '#9CA3AF' };
                  const date = new Date(dateStr);
                  const now = new Date();
                  const diff = date.getTime() - now.getTime();
                  const minutes = Math.floor(diff / (1000 * 60));
                  if (minutes < 0) return { text: 'Истёк', color: '#F2D6DE' };
                  if (minutes < 60) return { text: `${minutes} мин`, color: '#DED8F6' };
                  return { text: `${Math.floor(minutes / 60)} ч`, color: 'hsl(var(--primary))' };
                };
                const expiry = formatExpiry(reserve.reservationExpiry);
                return (
                  <motion.button
                    key={reserve.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.8 + index * 0.1 }}
                    onClick={() => router.push('/profile')}
                    className="w-full bg-[#1E2329] rounded-[20px] p-4 flex items-center justify-between active:scale-[0.98] transition-transform border border-white/5"
                  >
                    <div className="text-left">
                      <h4 className="text-[#F5F5F7] font-semibold mb-2">
                        {reserve.reservationCustomerName || 'Без имени'}
                      </h4>
                      <span
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${expiry.color}20`,
                          color: expiry.color,
                        }}
                      >
                        {expiry.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#DED8F6] font-bold text-lg">
                        {formatCurrency(reserve.finalAmount, currency)}
                      </span>
                      <ChevronRight size={18} className="text-[#6B7280]" strokeWidth={1.5} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#F5F5F7] text-sm font-semibold tracking-tight">
              Последние дни
            </h3>
            <button
              onClick={() => router.push('/reports')}
              className="text-[#BFE7E5] text-xs active:scale-95 transition-transform"
            >
              Все отчёты
            </button>
          </div>
          <div className="space-y-3">
            {dayReports.slice(0, 5).map((day, index) => (
              <motion.button
                key={day.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 1.1 + index * 0.1 }}
                onClick={() => router.push('/reports')}
                className="w-full bg-[#1E2329] rounded-[20px] p-4 flex items-center justify-between active:scale-[0.98] transition-transform border border-white/5"
              >
                <div className="text-left flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-[#F5F5F7] font-semibold">
                      {format(new Date(day.date), 'd MMM', { locale: ru })}
                    </h4>
                    <span className="text-[#6B7280] text-xs">•</span>
                    <span className="text-[#9CA3AF] text-xs">
                      {day.salesCount} продаж
                    </span>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    {day.lastSaleDescription || `${(day.revenue ?? 0).toLocaleString()}₽`}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-[#BFE7E5] font-bold">
                    {formatCurrency(day.revenue ?? 0, currency)}
                  </span>
                  <ChevronRight size={18} className="text-[#6B7280]" strokeWidth={1.5} />
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </div>

      <ReceiveModal open={showReceive} onOpenChange={setShowReceive} />
    </>
  );
}
