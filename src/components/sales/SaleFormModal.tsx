'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Minus,
  X,
  ChevronRight,
  ArrowLeft,
  ShoppingCart,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { flavorAvailableQuantity } from '@/lib/flavor-available-qty';
import type {
  InventoryResponse,
  Flavor,
  ProductFormat,
  Brand,
  Category,
  CreateSalePayload,
  Sale,
} from '@/types/api';

interface CartItem {
  flavorId: string;
  name: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

interface SaleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'debt' | 'reserve';
  title: string;
  description: string;
}

function CatalogView({
  inventory,
  onSelect,
}: {
  inventory: InventoryResponse;
  onSelect: (id: string) => void;
}) {
  const [path, setPath] = useState<(Category | Brand | ProductFormat)[]>([]);

  const currentLevel = path.length;
  const handleBack = () => setPath((prev) => prev.slice(0, -1));

  const items = () => {
    if (currentLevel === 0) return inventory?.categories || [];
    if (currentLevel === 1)
      return inventory?.brands.filter((b) => b.categoryId === path[0].id) || [];
    if (currentLevel === 2)
      return (
        inventory?.productFormats.filter((f) => f.brandId === path[1].id) || []
      );
    if (currentLevel === 3) {
      return (
        inventory?.flavors.filter(
          (f) =>
            f.productFormatId === path[2].id &&
            flavorAvailableQuantity(f) > 0
        ) || []
      );
    }
    return [];
  };

  const handleSelect = (item: Flavor | ProductFormat | Brand | Category) => {
    if (currentLevel === 3) {
      onSelect(item.id);
      setPath((prev) => prev.slice(0, -1));
    } else {
      setPath((prev) => [...prev, item as Category | Brand | ProductFormat]);
    }
  };

  return (
    <div className="h-[280px] flex flex-col border border-white/10 rounded-xl overflow-hidden bg-[#1B2030]">
      {currentLevel > 0 && (
        <div className="flex items-center gap-2 p-2 border-b border-white/10 bg-[#151922]">
          <button
            onClick={handleBack}
            className="h-7 w-7 rounded-lg bg-[#1B2030] flex items-center justify-center hover:bg-[#1B2030]/80 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex gap-1 text-xs text-[#9CA3AF] overflow-hidden">
            {path.map((p, i) => (
              <span key={i} className="flex items-center">
                {p.name} {i < path.length - 1 && <ChevronRight size={10} />}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2">
        {items().map((item: any) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center justify-between p-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 text-left transition-colors rounded-lg mb-1"
          >
            <div className="flex items-center gap-2">
              {item.emoji && <span>{item.emoji}</span>}
              {item.emojiPrefix && <span>{item.emojiPrefix}</span>}
              <span className="text-sm text-[#F5F5F7]">{item.name}</span>
            </div>
            {currentLevel === 3 ? (
              <Plus size={14} className="text-[#BFE7E5]" />
            ) : (
              <ChevronRight size={14} className="text-[#6B7280]" />
            )}
          </button>
        ))}
        {items().length === 0 && (
          <div className="text-center p-4 text-[#9CA3AF] text-sm">Пусто</div>
        )}
      </div>
    </div>
  );
}

export function SaleFormModal({
  open,
  onOpenChange,
  mode,
  title,
  description,
}: SaleFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [reservationExpiry, setReservationExpiry] = useState('');
  const [discount, setDiscount] = useState('');
  const [delivery, setDelivery] = useState('');
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
    enabled: open,
  });
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<InventoryResponse>('/api/inventory'),
    enabled: open,
  });
  const flavors = Array.isArray(inventoryData?.flavors) ? inventoryData.flavors : [];
  const productFormats =
    Array.isArray(inventoryData?.productFormats) ? inventoryData.productFormats : [];
  const brands = Array.isArray(inventoryData?.brands) ? inventoryData.brands : [];

  const searchResults =
    search.length >= 2
      ? flavors
          .filter((f) => {
            const format = productFormats.find((pf) => pf.id === f.productFormatId);
            const brand = format ? brands.find((b) => b.id === format.brandId) : null;
            const combined = `${brand?.name || ''} ${format?.name || ''} ${f.name}`.toLowerCase();
            return (
              combined.includes(search.toLowerCase()) && flavorAvailableQuantity(f) > 0
            );
          })
          .slice(0, 8)
      : [];

  const addToCart = (flavorId: string) => {
    const flavor = flavors.find((f) => f.id === flavorId);
    const avail = flavor ? flavorAvailableQuantity(flavor) : 0;
    if (!flavor || avail <= 0) {
      setError('Товар недоступен');
      return;
    }
    const existing = cart.find((c) => c.flavorId === flavorId);
    const format = productFormats.find((pf) => pf.id === flavor.productFormatId)!;
    const brand = brands.find((b) => b.id === format.brandId)!;

    if (existing) {
      if (existing.quantity + 1 > avail) {
        setError(`Доступно только ${avail}`);
        return;
      }
      setCart(
        cart.map((c) =>
          c.flavorId === flavorId ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          flavorId,
          name: flavor.name,
          productName: `${brand.name} ${format.name}`,
          unitPrice: format.unitPrice ?? 0,
          quantity: 1,
        },
      ]);
    }
    setSearch('');
    setError('');
  };

  const updateCartQty = (flavorId: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.flavorId !== flavorId) return c;
        const flavor = flavors.find((f) => f.id === flavorId);
        const availableQty = flavor ? flavorAvailableQuantity(flavor) : 0;
        const newQty = Math.max(1, Math.min(c.quantity + delta, availableQty));
        return { ...c, quantity: newQty };
      })
    );
  };

  const removeFromCart = (flavorId: string) => {
    setCart((prev) => prev.filter((c) => c.flavorId !== flavorId));
  };

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const discountAmount = Math.min(parseFloat(discount) || 0, subtotal);
  const deliveryAmount = Math.max(0, delivery ? parseFloat(delivery) || 0 : 0);
  const total = Math.max(0, subtotal - discountAmount + deliveryAmount);

  const createSale = useMutation({
    mutationFn: (payload: CreateSalePayload) =>
      api<Sale>('/api/sales', { method: 'POST', body: payload }),
    onSuccess: (data, variables) => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['reserves'] });

      const itemsList = variables.items
        .map((i) => `${i.flavorNameSnapshot} (${i.quantity} шт)`)
        .join(', ');
      toast({
        title: mode === 'debt' ? 'Продажа в долг оформлена' : 'Резерв оформлен',
        description: `${itemsList}. Сумма: ${formatCurrency(data.finalAmount, shopData?.currency)}`,
        duration: 4000,
      });

      setTimeout(() => {
        setShowSuccess(false);
        setCart([]);
        setCustomerName('');
        setReservationExpiry('');
        setDiscount('');
        setDelivery('');
        onOpenChange(false);
      }, 1500);
    },
    onError: (e: Error) => {
      setError(e.message);
      toast({
        title: 'Ошибка',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (cart.length === 0) {
      setError('Добавьте товары');
      return;
    }
    if (!customerName?.trim()) {
      setError(mode === 'debt' ? 'Укажите имя клиента' : 'Укажите имя клиента резерва');
      return;
    }

    if (mode === 'reserve') {
      if (!reservationExpiry?.trim()) {
        setError('Укажите дату и время окончания резерва');
        return;
      }
      const exp = new Date(reservationExpiry.trim());
      if (Number.isNaN(exp.getTime())) {
        setError('Некорректная дата окончания резерва');
        return;
      }
      if (exp.getTime() <= Date.now() + 60_000) {
        setError('Резерв должен заканчиваться позже текущего времени (минимум на 1 минуту)');
        return;
      }
    }

    for (const item of cart) {
      const flavor = flavors.find((f) => f.id === item.flavorId);
      const availableQty = flavor ? flavorAvailableQuantity(flavor) : 0;
      if (item.quantity > availableQty) {
        setError(`Товар "${item.name}": доступно ${availableQty}`);
        return;
      }
    }

    setError('');
    const items = cart.map((c) => ({
      flavorId: c.flavorId,
      productNameSnapshot: c.productName,
      flavorNameSnapshot: c.name,
      unitPrice: c.unitPrice,
      quantity: c.quantity,
      lineTotal: c.unitPrice * c.quantity,
    }));

    const payload: CreateSalePayload = {
      paymentType: mode === 'debt' ? 'debt' : 'cash',
      discountValue: discountAmount,
      discountType: 'absolute',
      deliveryAmount,
      comment: null,
      customerName: customerName.trim(),
      isReservation: mode === 'reserve',
      items,
    };
    if (mode === 'reserve') {
      payload.reservationExpiry = reservationExpiry?.trim() || undefined;
      payload.reservationCustomerName = customerName.trim();
    }

    createSale.mutate(payload);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setCart([]);
      setCustomerName('');
      setReservationExpiry('');
      setDiscount('');
      setDelivery('');
      setError('');
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#151922] border-[#1B2030]">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">{title}</DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {error && (
            <div className="text-sm text-[#F2D6DE] bg-[#F2D6DE]/10 rounded-lg p-2">
              {error}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              type="text"
              placeholder="Поиск товара..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#BFE7E5]/50"
            />
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#1B2030] rounded-xl border border-white/10 overflow-hidden shadow-lg"
                >
                {searchResults.map((f) => {
                  const format = productFormats.find((pf) => pf.id === f.productFormatId)!;
                  const brand = brands.find((b) => b.id === format.brandId)!;
                  return (
                    <button
                      key={f.id}
                      onClick={() => addToCart(f.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <p className="text-sm text-[#F5F5F7]">{f.name}</p>
                      <span className="text-xs text-[#BFE7E5] font-medium">
                        {formatCurrency(format.unitPrice ?? 0, shopData?.currency)}
                      </span>
                    </button>
                  );
                })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Catalog */}
          {inventoryData && (
            <CatalogView inventory={inventoryData} onSelect={addToCart} />
          )}

          {/* Cart */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Корзина ({cart.length})
              </p>
              <div className="bg-[#1B2030] rounded-xl border border-white/10 overflow-hidden max-h-32 overflow-y-auto">
                {cart.map((item) => {
                  const flavor = flavors.find((f) => f.id === item.flavorId);
                  const availableQty = flavor ? flavorAvailableQuantity(flavor) : 0;
                  return (
                    <div
                      key={item.flavorId}
                      className="flex items-center justify-between p-2.5 border-b border-white/5 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F5F5F7] truncate">{item.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{item.productName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQty(item.flavorId, -1)}
                          className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[#F5F5F7]"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-sm font-mono w-5 text-center text-[#F5F5F7]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQty(item.flavorId, 1)}
                          disabled={item.quantity >= availableQty}
                          className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[#F5F5F7] disabled:opacity-50"
                        >
                          <Plus size={10} />
                        </button>
                        <span className="text-sm font-medium text-[#BFE7E5] w-12 text-right">
                          {formatCurrency(item.unitPrice * item.quantity, shopData?.currency)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.flavorId)}
                          className="w-6 h-6 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#F2D6DE]"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer name */}
          <div>
            <label className="text-xs font-medium text-[#9CA3AF] mb-1 block">
              {mode === 'debt' ? 'Имя клиента' : 'Клиент резерва'}
            </label>
            <input
              type="text"
              placeholder="Введите имя..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#BFE7E5]/50"
            />
          </div>

          {mode === 'reserve' && (
            <div>
              <label className="text-xs font-medium text-[#9CA3AF] mb-1 block">
                Дата окончания резерва
              </label>
              <DateTimePicker
                value={reservationExpiry}
                onChange={setReservationExpiry}
                placeholder="Выберите дату и время"
              />
            </div>
          )}

          {/* Discount */}
          <div>
            <label className="text-xs font-medium text-[#9CA3AF] mb-1 block">
              Скидка ({getCurrencySymbol(shopData?.currency)})
            </label>
            <input
              type="number"
              placeholder="0"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm font-mono placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#BFE7E5]/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#9CA3AF] mb-1 block">
              Доставка ({getCurrencySymbol(shopData?.currency)})
            </label>
            <input
              type="number"
              placeholder="0"
              min="0"
              step="0.01"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm font-mono placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#BFE7E5]/50"
            />
          </div>

          {/* Total & Submit */}
          {cart.length > 0 && (
            <>
              {deliveryAmount > 0 && (
                <div className="flex justify-between text-xs text-[#9CA3AF] pt-1">
                  <span>Доставка</span>
                  <span className="font-mono-nums">{formatCurrency(deliveryAmount, shopData?.currency)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-t border-white/10">
                <span className="font-medium text-[#F5F5F7]">Итого</span>
                <span className="font-mono-nums font-bold text-lg text-[#BFE7E5]">
                  {formatCurrency(total, shopData?.currency)}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={createSale.isPending || showSuccess}
                className="w-full py-3 rounded-xl bg-[#BFE7E5] text-[#111111] font-semibold disabled:opacity-70 transition-colors"
              >
                {showSuccess
                  ? '✓ Готово!'
                  : mode === 'debt'
                    ? 'Оформить в долг'
                    : 'Оформить резерв'}
              </motion.button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
