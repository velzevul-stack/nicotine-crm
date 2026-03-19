'use client';

import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';

export function DeliveryTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-[#1B2030] rounded-[16px] p-5 border border-white/10">
        <div
          className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-4"
          style={{ backgroundColor: 'rgba(222, 216, 246, 0.2)' }}
        >
          <Truck size={28} className="text-[#DED8F6]" strokeWidth={1.5} />
        </div>
        <h3 className="text-[#F5F5F7] font-semibold text-base mb-2">Поставка</h3>
        <p className="text-[#9CA3AF] text-sm mb-0">
          Раздел в разработке. Скоро здесь появится учёт поставок.
        </p>
      </div>
    </motion.div>
  );
}
