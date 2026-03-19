'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const variantColors = {
  danger: '#F2D6DE',
  warning: '#DED8F6',
  info: '#CFE6F2',
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'warning',
}: ConfirmDialogProps) {
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#151922] rounded-[24px] p-6 max-w-sm w-full border border-[#1B2030] relative"
            >
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X size={20} className="text-muted-foreground" strokeWidth={1.5} />
              </button>
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${variantColors[variant]}20` }}
              >
                <AlertTriangle
                  size={28}
                  style={{ color: variantColors[variant] }}
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-[#F5F5F7] text-center mb-2 text-xl font-semibold tracking-tight">
                {title}
              </h3>
              <p className="text-[#9CA3AF] text-center mb-6 text-sm">
                {description}
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  {cancelText}
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                >
                  {confirmText}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
