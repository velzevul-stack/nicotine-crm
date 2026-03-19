'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, DollarSign, ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react';
import { SaleFormModal } from '@/components/sales/SaleFormModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { useHintSeen } from '@/hooks/use-hint-seen';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface DebtWithOps {
  id: string;
  customerName: string;
  totalDebt: number;
  updatedAt: string;
  operations: { id: string; amount: number; datetime: string; comment: string }[];
}

export function DebtsTab() {
  const [showHint] = useHintSeen('debts');
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState<DebtWithOps | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });
  const { data: debts = [] } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api<DebtWithOps[]>('/api/debts'),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: { debtId: string; amount: number; comment: string | null }) =>
      api('/api/debts', { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowPayment(null);
      setPaymentAmount('');
      setPaymentComment('');
    },
  });

  const totalDebt = debts.reduce((s, d) => s + d.totalDebt, 0);

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!showPayment || !amount || amount <= 0) return;
    paymentMutation.mutate({
      debtId: showPayment.id,
      amount,
      comment: paymentComment.trim() || null,
    });
  };

  return (
    <div className="space-y-3">
      {showHint && (
        <div className="bg-[#1B2030] rounded-[16px] p-4">
          <p className="text-xs text-[#9CA3AF] mb-2">
            <strong>Подсказка:</strong> Здесь отображаются все клиенты с задолженностью. 
            Нажмите на карточку должника, чтобы увидеть историю операций и принять оплату.
          </p>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowDebtModal(true)}
        className="w-full flex items-center justify-between p-4 rounded-[16px] bg-[#BFE7E5]/20 border border-[#BFE7E5]/30 text-[#BFE7E5] hover:bg-[#BFE7E5]/30 transition-colors mb-3"
      >
        <div className="flex items-center gap-2">
          <Plus size={18} strokeWidth={1.5} />
          <span className="font-semibold text-sm">Продать в долг</span>
        </div>
        <ChevronRight size={16} strokeWidth={1.5} />
      </motion.button>

      <SaleFormModal
        open={showDebtModal}
        onOpenChange={setShowDebtModal}
        mode="debt"
        title="Продать в долг"
        description="Выберите товары и укажите имя клиента"
      />

      <div className="bg-[#F2D6DE] rounded-[20px] p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(242, 214, 222, 0.5)' }}
          >
            <DollarSign size={18} className="text-[#111111]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-[#1A1A1A] opacity-70">Общий долг</p>
            <p className="font-mono-nums font-bold text-lg text-[#111111]">
              {formatCurrency(totalDebt, shopData?.currency)}
            </p>
          </div>
        </div>
      </div>

      {debts.map((debt) => (
        <motion.div
          key={debt.id}
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            setSelectedDebt(selectedDebt === debt.id ? null : debt.id)
          }
          className="w-full bg-[#1B2030] rounded-[16px] overflow-hidden text-left cursor-pointer"
        >
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-sm text-[#F5F5F7]">{debt.customerName}</p>
              <p className="text-xs text-[#9CA3AF]">
                Обновлено:{' '}
                {new Date(debt.updatedAt).toLocaleDateString('ru-RU')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono-nums font-bold text-[#F2D6DE]">
                {formatCurrency(debt.totalDebt, shopData?.currency)}
              </span>
              <ChevronRight
                size={14}
                className={`text-[#6B7280] transition-transform ${
                  selectedDebt === debt.id ? 'rotate-90' : ''
                }`}
              />
            </div>
          </div>

          <AnimatePresence>
            {selectedDebt === debt.id && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/10 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                    История операций
                  </p>
                  {(debt.operations ?? []).map((op) => (
                    <div
                      key={op.id}
                      className="flex items-start justify-between py-1"
                    >
                      <div className="flex items-start gap-2">
                        {op.amount > 0 ? (
                          <ArrowUpRight
                            size={14}
                            className="text-[#F2D6DE] mt-0.5"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <ArrowDownRight
                            size={14}
                            className="text-[#BFE7E5] mt-0.5"
                            strokeWidth={1.5}
                          />
                        )}
                        <div>
                          <p className="text-sm text-[#F5F5F7]">{op.comment}</p>
                          <p className="text-xs text-[#9CA3AF]">
                            {new Date(op.datetime).toLocaleString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-mono-nums text-sm font-medium ${
                          op.amount > 0 ? 'text-[#F2D6DE]' : 'text-[#BFE7E5]'
                        }`}
                      >
                        {op.amount > 0 ? '+' : ''}
                        {formatCurrency(op.amount, shopData?.currency)}
                      </span>
                    </div>
                  ))}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPayment(debt);
                    }}
                    className="w-full h-9 mt-2 rounded-[12px] bg-[#BFE7E5]/30 text-[#BFE7E5] text-sm font-medium hover:bg-[#BFE7E5]/40 transition-colors"
                  >
                    Принять оплату
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}

      <Dialog open={!!showPayment} onOpenChange={(o) => !o && setShowPayment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Принять оплату</DialogTitle>
            <DialogDescription>
              {showPayment?.customerName} • долг{' '}
              {formatCurrency(showPayment?.totalDebt ?? 0, shopData?.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={`Сумма (${shopData?.currency || 'BYN'})`}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="flex-1 h-10 px-4 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm font-mono-nums"
              />
              <button
                onClick={() => setPaymentAmount(String(showPayment?.totalDebt ?? 0))}
                className="h-10 px-3 rounded-xl bg-[#BFE7E5]/20 text-[#BFE7E5] text-xs font-medium whitespace-nowrap"
              >
                Полностью
              </button>
            </div>
            <input
              type="text"
              placeholder="Комментарий (необязательно)"
              value={paymentComment}
              onChange={(e) => setPaymentComment(e.target.value)}
              className="w-full h-10 px-4 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm"
            />
            <button
              onClick={handlePayment}
              disabled={
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0 ||
                paymentMutation.isPending
              }
              className="w-full h-11 rounded-[14px] bg-[#BFE7E5] text-[#111111] font-semibold disabled:opacity-50 transition-colors"
            >
              Записать оплату
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
