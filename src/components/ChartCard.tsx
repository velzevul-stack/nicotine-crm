'use client';

import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';

interface ChartDataPoint {
  day: string;
  value: number;
}

interface ChartCardProps {
  title?: string;
  data?: ChartDataPoint[];
  total?: string;
  trend?: string;
  delay?: number;
  currency?: string;
}

const pastelColors = [
  'hsl(var(--primary))',
  '#CFE6F2',
  '#DED8F6',
  '#F2D6DE',
  '#BFE7E5',
  '#A5D4D2',
  '#CFE6F2',
];

export function ChartCard({
  title = 'Прибыль за неделю',
  data,
  total,
  trend,
  delay = 0,
  currency = getCurrencySymbol('BYN'),
}: ChartCardProps) {
  const weekData =
    data ||
    [
      { day: 'Пн', value: 45000 },
      { day: 'Вт', value: 52000 },
      { day: 'Ср', value: 48000 },
      { day: 'Чт', value: 61000 },
      { day: 'Пт', value: 55000 },
      { day: 'Сб', value: 67000 },
      { day: 'Вс', value: 59000 },
    ];

  const totalWeek = weekData.reduce((sum, item) => sum + item.value, 0);
  const maxIndex = weekData.findIndex(
    (item) => item.value === Math.max(...weekData.map((d) => d.value))
  );
  const displayTotal = total ?? totalWeek.toLocaleString('ru-RU') + ' ' + currency;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay,
        ease: [0.25, 0.1, 0.25, 1.0],
      }}
      className="bg-[#1E2329]/90 backdrop-blur-sm rounded-[28px] p-6 border border-white/5"
      style={{
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25), 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-[#F5F5F7] mb-1 text-base font-semibold">{title}</h3>
          <p className="text-[#9CA3AF] text-xs font-normal">
            {new Date().toLocaleDateString('ru-RU', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        {(trend || !total) && (
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
            <TrendingUp size={14} className="text-primary" strokeWidth={2} />
            <span className="text-primary text-xs font-semibold">
              {trend ?? '+12.5%'}
            </span>
          </div>
        )}
      </div>
      <div className="mb-6">
        <p className="text-foreground text-2xl font-semibold leading-none tracking-tight">
          {displayTotal}
        </p>
      </div>
      <div className="h-[180px] min-w-0 -mx-2">
        <ResponsiveContainer width="100%" height={180} minWidth={0}>
          <BarChart data={weekData}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 12,
                fontWeight: 500,
              }}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              animationDuration={800}
              animationBegin={delay * 1000 + 200}
            >
              {weekData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === maxIndex ? 'hsl(var(--primary))' : pastelColors[index]}
                  opacity={index === maxIndex ? 1 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground text-xs font-normal">
            Обычный день
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground text-xs font-normal">
            Лучший день
          </span>
        </div>
      </div>
    </motion.div>
  );
}
