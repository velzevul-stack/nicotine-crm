'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-card rounded-[24px] p-8 text-center"
    >
      <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
        <Icon size={32} className="text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h3 className="text-foreground mb-2 text-lg font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6 text-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-[16px] font-medium hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
