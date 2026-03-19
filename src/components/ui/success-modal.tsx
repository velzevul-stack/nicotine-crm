'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = 'Продолжить',
}: SuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#151922] rounded-[24px] p-8 max-w-sm w-full text-center border border-[#1B2030] text-[#F5F5F7]"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
                className="w-20 h-20 mx-auto mb-6 bg-[#BFE7E5] rounded-full flex items-center justify-center"
              >
                <Check
                  size={40}
                  className="text-primary-foreground"
                  strokeWidth={3}
                />
              </motion.div>
              <h3 className="text-[#F5F5F7] mb-2 text-2xl font-semibold tracking-tight">
                {title}
              </h3>
              <p className="text-[#9CA3AF] mb-8 text-sm">{message}</p>
              <Button className="w-full" size="lg" onClick={onClose}>
                {actionLabel}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
