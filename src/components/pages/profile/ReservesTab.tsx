'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Package, Clock, X, Plus, ShoppingCart } from 'lucide-react';
import { SaleFormModal } from '@/components/sales/SaleFormModal';
import { SellReservationModal } from '@/components/inventory/SellReservationModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { useHintSeen } from '@/hooks/use-hint-seen';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ReservationItem {
  id: string;
  flavorId: string;
  productNameSnapshot: string;
  flavorNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface Reservation {
  id: string;
  reservationCustomerName: string | null;
  reservationExpiry: string | null;
  datetime: string;
  totalAmount: number;
  finalAmount: number;
  items: ReservationItem[];
}

export function ReservesTab() {
  const { toast } = useToast();
  const [showHint] = useHintSeen('reserves');
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState<Reservation | null>(null);
  const [showSellReservation, setShowSellReservation] = useState<Reservation | null>(null);
  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });

  const { data: reserves = [], refetch: refetchReserves } = useQuery({
    queryKey: ['reserves'],
    queryFn: () => api<Reservation[]>('/api/reserves'),
  });

  // Автоматически возвращаем истекшие резервы и обновляем данные (один механизм polling)
  useEffect(() => {
    const checkExpiredReserves = async () => {
      try {
        await api('/api/reserves', { method: 'POST' });
        refetchReserves();
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      } catch (error) {
        // Игнорируем ошибки при автоматической проверке
      }
    };

    // Первая проверка при монтировании
    checkExpiredReserves();
    
    // Периодическая проверка каждую минуту (60 секунд)
    const interval = setInterval(checkExpiredReserves, 60000);
    return () => clearInterval(interval);
  }, [refetchReserves, queryClient]);

  const cancelMutation = useMutation({
    mutationFn: (reservationId: string) =>
      api('/api/reserves', { method: 'DELETE', body: { reservationId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserves'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowCancel(null);
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось отменить резерв',
        variant: 'destructive',
      });
    },
  });

  const totalReservedValue = reserves.reduce((s, r) => s + r.finalAmount, 0);

  const formatExpiryDate = (expiry: string | null) => {
    if (!expiry) return 'Без срока';
    const date = new Date(expiry);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) return 'Истек';
    if (diffMins < 60) return `Через ${diffMins} мин`;
    if (diffHours < 24) return `Через ${diffHours} ч`;
    return `Через ${diffDays} дн`;
  };

  const getExpiryStatus = (expiry: string | null) => {
    if (!expiry) return 'text-[#9CA3AF]';
    const date = new Date(expiry);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / 3600000;

    if (diffMs < 0) return 'text-[#F2D6DE]';
    if (diffHours < 1) return 'text-[#F2D6DE]';
    return 'text-[#BFE7E5]';
  };

  return (
    <div className="space-y-3">
      {showHint && (
        <div className="bg-[#1B2030] rounded-[16px] p-4">
          <p className="text-xs text-[#9CA3AF] mb-2">
            <strong>Подсказка:</strong> Здесь отображаются все активные резервы.
            Резервированные товары скрыты из прайс-листа до истечения времени резерва или его отмены.
          </p>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowReserveModal(true)}
        className="w-full flex items-center justify-between p-4 rounded-[16px] bg-[#DED8F6]/20 border border-[#DED8F6]/30 text-[#DED8F6] hover:bg-[#DED8F6]/30 transition-colors mb-3"
      >
        <div className="flex items-center gap-2">
          <Plus size={18} strokeWidth={1.5} />
          <span className="font-semibold text-sm">Зарезервировать</span>
        </div>
        <ChevronRight size={16} strokeWidth={1.5} />
      </motion.button>

      <SaleFormModal
        open={showReserveModal}
        onOpenChange={setShowReserveModal}
        mode="reserve"
        title="Зарезервировать"
        description="Выберите товары, укажите клиента и дату окончания резерва"
      />

      <div className="bg-[#DED8F6] rounded-[20px] p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(222, 216, 246, 0.5)' }}
          >
            <Package size={18} className="text-[#111111]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-[#1A1A1A] opacity-70">Всего резервов</p>
            <p className="font-mono-nums font-bold text-lg text-[#111111]">
              {reserves.length} • {formatCurrency(totalReservedValue, shopData?.currency)}
            </p>
          </div>
        </div>
      </div>

      {reserves.length === 0 ? (
        <div className="bg-[#1B2030] rounded-[16px] p-8 text-center">
          <Package size={32} className="text-[#6B7280] mx-auto mb-2 opacity-50" strokeWidth={1.5} />
          <p className="text-sm text-[#9CA3AF]">Нет активных резервов</p>
        </div>
      ) : (
        reserves.map((reservation) => (
          <motion.div
            key={reservation.id}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              setSelectedReservation(
                selectedReservation === reservation.id ? null : reservation.id
              )
            }
            className="w-full bg-[#1B2030] rounded-[16px] overflow-hidden text-left cursor-pointer"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex-1">
                <p className="font-medium text-sm text-[#F5F5F7]">
                  {reservation.reservationCustomerName || 'Без имени'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={12} className={`${getExpiryStatus(reservation.reservationExpiry)}`} />
                  <p className={`text-xs ${getExpiryStatus(reservation.reservationExpiry)}`}>
                    {formatExpiryDate(reservation.reservationExpiry)}
                  </p>
                  <span className="text-xs text-[#6B7280]">•</span>
                  <p className="text-xs text-[#9CA3AF]">
                    {new Date(reservation.datetime).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-nums font-bold text-[#BFE7E5]">
                  {formatCurrency(reservation.finalAmount, shopData?.currency)}
                </span>
                <ChevronRight
                  size={14}
                  className={`text-[#6B7280] transition-transform ${
                    selectedReservation === reservation.id ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </div>

            <AnimatePresence>
              {selectedReservation === reservation.id && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/10 px-4 py-3 space-y-2">
                    <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                      Товары в резерве
                    </p>
                    {(reservation.items ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between py-1"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-[#F5F5F7]">{item.flavorNameSnapshot}</p>
                          <p className="text-xs text-[#9CA3AF]">
                            {item.productNameSnapshot}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-[#F5F5F7]">
                            {item.quantity} × {formatCurrency(item.unitPrice, shopData?.currency)}
                          </p>
                          <p className="text-xs text-[#9CA3AF]">
                            {formatCurrency(item.lineTotal, shopData?.currency)}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2 mt-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSellReservation(reservation);
                        }}
                        className="flex-1 h-9 rounded-[12px] bg-[#BFE7E5]/30 text-[#BFE7E5] text-sm font-medium hover:bg-[#BFE7E5]/40 transition-colors flex items-center justify-center gap-2"
                      >
                        <ShoppingCart size={14} />
                        Продать резерв
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCancel(reservation);
                        }}
                        className="flex-1 h-9 rounded-[12px] bg-[#F2D6DE]/30 text-[#F2D6DE] text-sm font-medium hover:bg-[#F2D6DE]/40 transition-colors flex items-center justify-center gap-2"
                      >
                        <X size={14} />
                        Отменить резерв
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))
      )}

      <SellReservationModal
        open={!!showSellReservation}
        onOpenChange={(o) => !o && setShowSellReservation(null)}
        reservationId={showSellReservation?.id ?? ''}
        reservationData={showSellReservation ? {
          reservationCustomerName: showSellReservation.reservationCustomerName,
          reservationExpiry: showSellReservation.reservationExpiry,
          finalAmount: showSellReservation.finalAmount,
        } : undefined}
      />

      <Dialog open={!!showCancel} onOpenChange={(o) => !o && setShowCancel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Отменить резерв?</DialogTitle>
            <DialogDescription>
              Товары будут возвращены в прайс-лист и станут доступны для продажи.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {showCancel && (
              <div className="space-y-2">
                <p className="text-sm text-[#9CA3AF]">
                  Клиент: <strong className="text-[#F5F5F7]">{showCancel.reservationCustomerName || 'Без имени'}</strong>
                </p>
                <p className="text-sm text-[#9CA3AF]">
                  Сумма: <strong className="text-[#F5F5F7]">{formatCurrency(showCancel.finalAmount, shopData?.currency)}</strong>
                </p>
                <p className="text-sm text-[#9CA3AF]">
                  Товаров: <strong className="text-[#F5F5F7]">{showCancel.items.length}</strong>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancel(null)}
                className="flex-1 h-11 rounded-[14px] bg-[#1B2030] text-[#F5F5F7] text-sm font-medium hover:bg-[#1B2030]/80 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (showCancel) {
                    cancelMutation.mutate(showCancel.id);
                  }
                }}
                disabled={cancelMutation.isPending}
                className="flex-1 h-11 rounded-[14px] bg-[#F2D6DE] text-[#111111] font-semibold disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? 'Отмена...' : 'Отменить резерв'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
