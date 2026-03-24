'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { BarChart3, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { formatInTimeZone } from 'date-fns-tz';

export function ReportsCardTab() {
  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string; timezone?: string }>('/api/shop'),
  });
  const shopTz = shopData?.timezone?.trim() || 'Europe/Minsk';
  const today = formatInTimeZone(new Date(), shopTz, 'yyyy-MM-dd');
  const { data } = useQuery({
    queryKey: ['reports', today, shopTz],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('from', today);
      params.set('to', today);
      return api<{ dayReports: { revenue: number; profit: number; salesCount: number }[] }>(
        `/api/reports?${params.toString()}`
      );
    },
  });

  const todayReport = data?.dayReports?.[0];

  return (
    <div className="space-y-4">
      {todayReport ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1B2030] rounded-[16px] p-4 border border-white/10"
        >
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2">Сегодня</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono-nums font-bold text-[#BFE7E5]">
                {formatCurrency(todayReport.revenue, shopData?.currency)}
              </p>
              <p className="text-[10px] text-[#9CA3AF]">Выручка</p>
            </div>
            <div>
              <p className="font-mono-nums font-bold text-[#9FD4D1]">
                {formatCurrency(todayReport.profit, shopData?.currency)}
              </p>
              <p className="text-[10px] text-[#9CA3AF]">Прибыль</p>
            </div>
            <div>
              <p className="font-mono-nums font-bold text-[#DED8F6]">
                {todayReport.salesCount}
              </p>
              <p className="text-[10px] text-[#9CA3AF]">Продаж</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-[#1B2030] rounded-[16px] p-4 border border-white/10">
          <p className="text-sm text-[#9CA3AF]">Нет данных за сегодня</p>
        </div>
      )}
      <Link href="/reports" className="block">
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between p-4 rounded-[16px] bg-[#BFE7E5]/10 border border-[#BFE7E5]/20 text-[#BFE7E5] hover:bg-[#BFE7E5]/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={20} strokeWidth={1.5} />
            <span className="font-semibold">Перейти к отчётам</span>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} />
        </motion.button>
      </Link>
    </div>
  );
}
