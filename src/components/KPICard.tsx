'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

/** Два гармоничных цвета для пар карточек (SKILL: cohesive palette, dominant + accent) */
export const CARD_COLORS = {
  mint: {
    gradient: 'linear-gradient(135deg, #9ED9D4 0%, #BFE7E5 50%, #B8E8D8 100%)',
    iconColor: '#BFE7E5',
    shadow: '0 4px 24px rgba(158, 217, 212, 0.35)',
  },
  periwinkle: {
    gradient: 'linear-gradient(135deg, #B8C4E8 0%, #D4D8F0 50%, #C8D0EC 100%)',
    iconColor: '#D4D8F0',
    shadow: '0 4px 24px rgba(184, 196, 232, 0.35)',
  },
} as const;

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: keyof typeof CARD_COLORS;
  delay?: number;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  delay = 0,
  onClick,
}: KPICardProps) {
  const config = CARD_COLORS[color];
  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay,
        ease: [0.25, 0.1, 0.25, 1.0],
      }}
      whileTap={{ scale: 0.98 }}
      className="rounded-[28px] p-5 cursor-pointer transition-all duration-300 hover:shadow-xl text-[#111111] overflow-hidden"
      style={{
        background: config.gradient,
        boxShadow: config.shadow,
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="p-2.5 rounded-[14px] bg-[#0F1115] shrink-0">
            <Icon size={22} strokeWidth={1.5} style={{ color: config.iconColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="opacity-70 text-xs font-semibold uppercase tracking-wider mb-2">{title}</p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <p className="text-2xl font-bold leading-none tracking-tight">
                {value}
              </p>
              {subtitle && (
                <span className="opacity-60 text-sm font-medium">{subtitle}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
