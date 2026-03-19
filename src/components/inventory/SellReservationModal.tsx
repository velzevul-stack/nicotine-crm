'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Banknote, CreditCard, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface SellReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  reservationData?: {
    reservationCustomerName?: string | null;
    reservationExpiry?: string | null;
    finalAmount: number;
  };
}

export function SellReservationModal({
  open,
  onOpenChange,
  reservationId,
  reservationData,
}: SellReservationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'debt'>('cash');

  const sellReservationMutation = useMutation({
    mutationFn: (paymentType: 'cash' | 'card' | 'debt') =>
      api(`/api/reservations/${reservationId}/sell`, {
        method: 'POST',
        body: { paymentType },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['reserves'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      onOpenChange(false);
      toast({
        title: 'Резерв продан',
        description: 'Товары списаны со склада',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось продать резерв',
        variant: 'destructive',
      });
    },
  });

  const paymentOptions = [
    { value: 'cash' as const, icon: Banknote, label: 'Наличка' },
    { value: 'card' as const, icon: CreditCard, label: 'Карта' },
    { value: 'debt' as const, icon: Clock, label: 'В долг' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Продать резерв</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {reservationData?.reservationCustomerName && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Клиент</p>
              <p className="text-sm font-medium">{reservationData.reservationCustomerName}</p>
            </div>
          )}
          {reservationData?.reservationExpiry && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">До</p>
              <p className="text-sm font-medium">
                {new Date(reservationData.reservationExpiry).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Способ оплаты</p>
            <div className="flex gap-2">
              {paymentOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentType(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-[14px] text-sm transition-all ${
                      paymentType === opt.value
                        ? 'bg-[#BFE7E5]/20 ring-2 ring-[#BFE7E5] text-[#BFE7E5]'
                        : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                    }`}
                  >
                    <Icon size={14} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => sellReservationMutation.mutate(paymentType)}
            disabled={sellReservationMutation.isPending}
            className="bg-[#BFE7E5] text-[#111111] hover:opacity-90"
          >
            {sellReservationMutation.isPending ? 'Продажа...' : 'Продать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
