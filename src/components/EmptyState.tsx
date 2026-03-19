'use client';

import { motion } from 'framer-motion';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  hint?: string;
}

export function EmptyState({
  message = 'Нет данных для отображения',
  hint = 'Данные появятся после первой транзакции',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-card rounded-[24px] p-12 flex flex-col items-center justify-center text-center"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Database size={32} className="text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-muted-foreground mb-2 text-base font-medium">{message}</p>
      <p className="text-muted-foreground/80 text-sm font-normal">{hint}</p>
    </motion.div>
  );
}
