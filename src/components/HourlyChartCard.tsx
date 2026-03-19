'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export interface HourlyDataPoint {
  hour: string;
  receipts: number;
  items: number;
}

interface HourlyChartCardProps {
  data: HourlyDataPoint[];
  delay?: number;
}

const RECEIPTS_COLOR = '#BFE7E5';
const ITEMS_COLOR = '#DED8F6';
const HOURS_PER_PAGE = 8;

export function HourlyChartCard({ data, delay = 0 }: HourlyChartCardProps) {
  const totalReceipts = data.reduce((s, d) => s + d.receipts, 0);
  const totalItems = data.reduce((s, d) => s + d.items, 0);

  const totalPages = Math.ceil(data.length / HOURS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(0);

  const paginatedData = data.slice(
    currentPage * HOURS_PER_PAGE,
    (currentPage + 1) * HOURS_PER_PAGE
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay,
        ease: [0.25, 0.1, 0.25, 1.0],
      }}
      className="bg-[#1E2329]/90 backdrop-blur-sm rounded-[28px] p-6 border border-white/5 overflow-hidden"
      style={{
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25), 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      <div className="mb-4">
        <h3 className="text-[#F5F5F7] mb-1 text-base font-semibold">
          Продажи и чеки по часам
        </h3>
        <p className="text-[#9CA3AF] text-xs font-normal">
          {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: RECEIPTS_COLOR }}
          />
          <span className="text-[#9CA3AF] text-xs">Чеки: {totalReceipts} шт</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: ITEMS_COLOR }}
          />
          <span className="text-[#9CA3AF] text-xs">Продажи: {totalItems} шт</span>
        </div>
      </div>

      <div className="h-[200px] -mx-2 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paginatedData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                  }}
                  width={24}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '6px 10px',
                  }}
                  formatter={(value: unknown, name?: unknown) => [
                    `${Number(value ?? 0)} шт`,
                    String(name) === 'receipts' ? 'Чеки' : 'Продажи',
                  ]}
                  labelFormatter={(label) => `Час ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  iconType="square"
                  iconSize={10}
                  formatter={(value) => (value === 'receipts' ? 'Чеки' : 'Продажи')}
                />
                <Bar
                  dataKey="receipts"
                  fill={RECEIPTS_COLOR}
                  radius={[4, 4, 0, 0]}
                  name="receipts"
                  maxBarSize={28}
                  animationDuration={600}
                  animationBegin={delay * 1000 + 200}
                />
                <Bar
                  dataKey="items"
                  fill={ITEMS_COLOR}
                  radius={[4, 4, 0, 0]}
                  name="items"
                  maxBarSize={28}
                  animationDuration={600}
                  animationBegin={delay * 1000 + 300}
                />
              </ComposedChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => (p - 1 + totalPages) % totalPages)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Предыдущий блок"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentPage(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentPage ? 'bg-primary scale-125' : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Страница ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => (p + 1) % totalPages)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Следующий блок"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </motion.div>
  );
}
