'use client';

import { motion } from 'framer-motion';

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="bg-[#1E2329] rounded-[28px] p-5 h-[120px] border border-white/5"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-auto">
              <div className="h-3 bg-muted rounded w-20 animate-pulse" />
              <div className="w-5 h-5 bg-muted rounded-full animate-pulse" />
            </div>
            <div className="mt-4">
              <div className="h-10 bg-muted rounded w-24 animate-pulse" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
