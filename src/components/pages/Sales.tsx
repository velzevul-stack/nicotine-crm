'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Search, Plus, Minus, X, ShoppingCart, CreditCard, Banknote, Wallet, ChevronRight, ArrowLeft, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { useToast } from '@/hooks/use-toast';
import type { InventoryResponse, ReservesResponse, Flavor, ProductFormat, Brand, Category, CreateSalePayload, Sale } from '@/types/api';

interface CartItem {
  flavorId: string;
  name: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export function Sales() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'split' | 'debt'>('cash');
  const [isDebt, setIsDebt] = useState(false);
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isReservation, setIsReservation] = useState(false);
  const [reservationExpiry, setReservationExpiry] = useState('');
  const [reservationCustomerName, setReservationCustomerName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<InventoryResponse>('/api/inventory'),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api<{ id: string; name: string }[]>('/api/cards'),
  });

  // Получаем активные резервы для фильтрации товаров из прайс-листа
  const { data: reserves = [], refetch: refetchReserves } = useQuery({
    queryKey: ['reserves'],
    queryFn: () => api<ReservesResponse>('/api/reserves'),
  });

  // Ручной polling для резервов (каждые 30 секунд)
  useEffect(() => {
    const interval = setInterval(() => {
      refetchReserves();
    }, 30000); // 30 секунд

    return () => clearInterval(interval);
  }, [refetchReserves]);

  // Создаем Set из flavorId, которые находятся в активных резервах
  const reservedFlavorIds = new Set<string>();
  reserves.forEach((reservation) => {
    reservation.items?.forEach((item) => {
      reservedFlavorIds.add(item.flavorId);
    });
  });

  const createSale = useMutation({
    mutationFn: (payload: CreateSalePayload) =>
      api<Sale>('/api/sales', { method: 'POST', body: payload }),
    onSuccess: (data, variables) => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['reserves'] });
      
      // Формируем детальное сообщение о продаже
      const itemsList = variables.items.map((item) => {
        return `${item.flavorNameSnapshot} (${item.quantity} шт)`;
      }).join(', ');
      
      const pt = variables.paymentType;
      const paymentTypeLabel = pt === 'cash' ? 'наличными' : pt === 'card' ? 'картой' : pt === 'debt' ? 'в долг' : 'сплит (наличные + карта)';
      const actionLabel = isReservation ? 'Резерв оформлен' : 'Продажа оформлена';
      
      toast({
        title: actionLabel,
        description: `${itemsList}. Оплата: ${paymentTypeLabel}. Сумма: ${formatCurrency(data.finalAmount, shopData?.currency)}`,
        duration: 4000,
      });
      
      setTimeout(() => {
        setShowSuccess(false);
        setCart([]);
        setDiscount('');
        setCustomerName('');
        setSplitCash('');
        setSplitCard('');
        setSelectedCardId(null);
        setIsDebt(false);
        setIsReservation(false);
        setReservationExpiry('');
        setReservationCustomerName('');
      }, 2000);
    },
    onError: (e: Error) => {
      setError(e.message);
      toast({
        title: 'Ошибка продажи',
        description: e.message || 'Не удалось оформить продажу',
        variant: 'destructive',
      });
    },
  });

  const [activeTab, setActiveTab] = useState<'search' | 'catalog'>('search');
  const flavors = Array.isArray(inventoryData?.flavors) ? inventoryData.flavors : [];
  const productFormats = Array.isArray(inventoryData?.productFormats) ? inventoryData.productFormats : [];
  const brands = Array.isArray(inventoryData?.brands) ? inventoryData.brands : [];
  const categories = Array.isArray(inventoryData?.categories) ? inventoryData.categories : [];

  const searchResults =
    search.length >= 2
      ? flavors
          .filter((f) => {
            // Скрываем товары, которые находятся в активных резервах
            if (reservedFlavorIds.has(f.id)) {
              return false;
            }
            const format = productFormats.find((pf) => pf.id === f.productFormatId);
            const brand = format
              ? brands.find((b) => b.id === format.brandId)
              : null;
            const combined = `${brand?.name || ''} ${format?.name || ''} ${f.name}`.toLowerCase();
            return combined.includes(search.toLowerCase()) && (f.quantity ?? 0) > 0;
          })
          .slice(0, 8)
      : [];

  const addToCart = (flavorId: string) => {
    const flavor = flavors.find((f) => f.id === flavorId);
    if (!flavor) {
      setError('Товар не найден');
      return;
    }

    const availableQty = flavor.quantity ?? 0;
    if (availableQty <= 0) {
      setError('Товар отсутствует на складе');
      return;
    }

    const existing = cart.find((c) => c.flavorId === flavorId);
    if (existing) {
      // Проверяем, не превышает ли новое количество остаток
      const newQty = existing.quantity + 1;
      if (newQty > availableQty) {
        setError(`Доступно только ${availableQty} единиц товара`);
        return;
      }
      setCart(
        cart.map((c) =>
          c.flavorId === flavorId ? { ...c, quantity: newQty } : c
        )
      );
    } else {
      const format = productFormats.find((pf) => pf.id === flavor.productFormatId)!;
      const brand = brands.find((b) => b.id === format.brandId)!;
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
        const availableQty = flavor?.quantity ?? 0;
        
        if (availableQty <= 0) {
          setError('Товар отсутствует на складе');
          return c;
        }

        const newQty = c.quantity + delta;
        
        // Не позволяем уменьшить ниже 1
        if (newQty < 1) {
          return c;
        }
        
        // Не позволяем превысить остаток
        if (newQty > availableQty) {
          setError(`Доступно только ${availableQty} единиц товара`);
          return { ...c, quantity: availableQty };
        }
        
        setError('');
        return { ...c, quantity: newQty };
      })
    );
  };

  const removeFromCart = (flavorId: string) => {
    setCart((prev) => prev.filter((c) => c.flavorId !== flavorId));
  };

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const discountInput = discount ? parseFloat(discount) || 0 : 0;
  const discountAmount = Math.min(discountInput, subtotal); // Скидка не может быть больше стоимости
  const total = Math.max(0, subtotal - discountAmount);

  const handleSubmit = () => {
    if (cart.length === 0) {
      setError('Добавьте товары в корзину');
      return;
    }
    
    // Проверяем остатки перед отправкой
    for (const item of cart) {
      const flavor = flavors.find((f) => f.id === item.flavorId);
      const availableQty = flavor?.quantity ?? 0;
      
      if (availableQty <= 0) {
        setError(`Товар "${item.name}" отсутствует на складе`);
        return;
      }
      
      if (item.quantity > availableQty) {
        setError(`Товар "${item.name}": доступно только ${availableQty} единиц, в корзине ${item.quantity}`);
        return;
      }
    }
    
    if (paymentType === 'split') {
      const cashVal = parseFloat(splitCash) || 0;
      const cardVal = parseFloat(splitCard) || 0;
      if (Math.abs(cashVal + cardVal - total) > 0.01) {
        setError(`Сумма наличных и карты должна равняться итогу (${total})`);
        return;
      }
    }
    if (paymentType === 'debt' && (!customerName || !customerName.trim())) {
      setError('Укажите имя клиента для продажи в долг');
      return;
    }
    if (discountInput > subtotal) {
      setError(`Скидка не может быть больше стоимости товаров (${subtotal})`);
      return;
    }
    if (discountInput < 0) {
      setError('Скидка не может быть отрицательной');
      return;
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
    const effectivePaymentType = isDebt ? 'debt' : paymentType;
    const payload: Record<string, unknown> = {
      paymentType: effectivePaymentType,
      discountValue: discountAmount,
      discountType: 'absolute' as const,
      comment: null,
      customerName: effectivePaymentType === 'debt' && customerName?.trim() ? customerName.trim() : null,
      isReservation: Boolean(isReservation),
      reservationExpiry: isReservation && reservationExpiry && reservationExpiry.trim() ? reservationExpiry.trim() : (isReservation ? null : undefined),
      reservationCustomerName: isReservation && reservationCustomerName && reservationCustomerName.trim() ? reservationCustomerName.trim() : (isReservation ? null : undefined),
      items,
    };
    if (effectivePaymentType === 'split') {
      payload.cashAmount = parseFloat(splitCash) || 0;
      payload.cardAmount = parseFloat(splitCard) || 0;
    }
    if ((effectivePaymentType === 'card' || effectivePaymentType === 'split') && selectedCardId) {
      payload.cardId = selectedCardId;
    }
    createSale.mutate(payload as unknown as CreateSalePayload);
  };

  const paymentOptions = [
    { value: 'cash' as const, icon: Banknote, label: 'Наличка' },
    { value: 'card' as const, icon: CreditCard, label: 'Карта' },
    { value: 'split' as const, icon: Wallet, label: 'Сплит' },
  ];

  return (
    <>
      <ScreenHeader
        title="Продажа"
        subtitle={cart.length > 0 ? `${cart.length} позиций в корзине` : 'Добавьте товары'}
      />

      <div className="px-4 space-y-4 pb-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'catalog')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="search">Поиск</TabsTrigger>
            <TabsTrigger value="catalog">Каталог</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-0">
            <div className="relative">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Поиск товара..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-[18px] bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-12 left-0 right-0 z-20 bg-card rounded-[18px] border border-border overflow-hidden shadow-lg"
                  >
                    {searchResults.map((f) => {
                        const format = productFormats.find(
                          (pf) => pf.id === f.productFormatId
                        )!;
                      const brand = brands.find((b) => b.id === format.brandId)!;
                      return (
                        <button
                          key={f.id}
                          onClick={() => addToCart(f.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                        >
                          <div className="text-left flex-1">
                            <p className="text-sm font-medium">{f.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {brand.emojiPrefix} {format.name} • {f.quantity} шт
                            </p>
                          </div>
                          <span className="font-mono-nums text-sm text-primary font-semibold ml-3">
                            {formatCurrency(format.unitPrice ?? 0, shopData?.currency)}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>

          <TabsContent value="catalog" className="mt-0">
            {inventoryData && (
              <CatalogView
                inventory={inventoryData}
                onSelect={addToCart}
                reservedFlavorIds={reservedFlavorIds}
              />
            )}
          </TabsContent>
        </Tabs>

        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">
                {error}
              </div>
            )}
            <div className="bg-card rounded-[20px] border border-border overflow-hidden">
              <div className="p-3 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart size={12} /> Корзина
                </p>
              </div>
              {cart.map((item) => {
                const flavor = flavors.find((f) => f.id === item.flavorId);
                const availableQty = flavor?.quantity ?? 0;
                const canIncrease = item.quantity < availableQty;
                
                return (
                  <div
                    key={item.flavorId}
                    className="flex items-center justify-between p-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.productName}
                        {availableQty > 0 && (
                          <span className="ml-2 text-muted-foreground/70">
                            • Доступно: {availableQty}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={() => updateCartQty(item.flavorId, -1)}
                        className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="font-mono-nums text-sm w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.flavorId, 1)}
                        disabled={!canIncrease}
                        className={`w-6 h-6 rounded-md bg-secondary flex items-center justify-center transition-colors ${
                          canIncrease
                            ? 'hover:bg-secondary/80'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Plus size={10} />
                      </button>
                      <span className="font-mono-nums text-sm font-medium w-14 text-right">
                        {formatCurrency(item.unitPrice * item.quantity, shopData?.currency)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.flavorId)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Оплата
              </p>
              <div className="flex gap-2">
                {paymentOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = !isDebt && paymentType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setIsDebt(false);
                        setPaymentType(opt.value);
                      }}
                      disabled={isDebt}
                      className={`flex-1 py-2.5 rounded-[14px] flex items-center justify-center gap-1.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isDebt
                            ? 'bg-card border border-border opacity-50 cursor-not-allowed'
                            : 'bg-card border border-border hover:bg-muted'
                      }`}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={isDebt}
                  onChange={(e) => {
                    setIsDebt(e.target.checked);
                    if (e.target.checked) {
                      setPaymentType('debt');
                    } else {
                      setPaymentType('cash');
                    }
                  }}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Clock size={14} className="text-warning" />
                <span className="text-sm font-medium">В долг</span>
              </label>
              {isDebt && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3"
                >
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Имя клиента
                  </label>
                  <input
                    type="text"
                    placeholder="Введите имя клиента..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full py-3 px-4 rounded-[14px] bg-muted border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </motion.div>
              )}
            </div>

            {(paymentType === 'card' || paymentType === 'split') && !isDebt && cards.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Карта</label>
                <select
                  value={selectedCardId ?? ''}
                  onChange={(e) => setSelectedCardId(e.target.value || null)}
                  className="w-full py-3 px-4 rounded-[14px] bg-muted border border-border text-sm"
                >
                  <option value="">Без привязки</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {paymentType === 'split' && !isDebt && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-2 gap-2"
              >
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Наличные</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="w-full py-3 px-4 rounded-[14px] bg-muted border border-border text-sm font-mono-nums placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Карта</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value)}
                    className="w-full py-3 px-4 rounded-[14px] bg-muted border border-border text-sm font-mono-nums placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Итого: {formatCurrency(total, shopData?.currency)} • Наличные + Карта = {formatCurrency((parseFloat(splitCash) || 0) + (parseFloat(splitCard) || 0), shopData?.currency)}
                </p>
              </motion.div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReservation}
                  onChange={(e) => setIsReservation(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Резерв (не учитывать в выручке)</span>
              </label>
              {isReservation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 space-y-3"
                >
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Клиент резерва
                    </label>
                    <input
                      type="text"
                      placeholder="Имя клиента..."
                      value={reservationCustomerName}
                      onChange={(e) => setReservationCustomerName(e.target.value)}
                      className="w-full py-3 px-4 rounded-[14px] bg-muted border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Дата и время окончания резерва
                    </label>
                    <DateTimePicker
                      value={reservationExpiry}
                      onChange={setReservationExpiry}
                      placeholder="Выберите дату и время"
                    />
                  </div>
                </motion.div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Скидка ({getCurrencySymbol(shopData?.currency)})
              </p>
              <input
                type="number"
                placeholder="0"
                min="0"
                max={subtotal}
                step="0.01"
                value={discount}
                onChange={(e) => {
                  const val = e.target.value;
                  const numVal = val === '' ? 0 : parseFloat(val) || 0;
                  if (numVal <= subtotal && numVal >= 0) {
                    setDiscount(val);
                    setError('');
                  } else if (numVal > subtotal) {
                    setError(`Скидка не может быть больше ${subtotal}`);
                  }
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                className="w-full py-3 px-4 rounded-[14px] bg-muted border border-border text-sm font-mono-nums placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="bg-card rounded-[20px] border border-border p-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-muted-foreground">Подытог</span>
                <span className="font-mono-nums text-sm">
                  {formatCurrency(subtotal, shopData?.currency)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted-foreground">Скидка</span>
                  <span className="font-mono-nums text-sm text-destructive">
                    -{formatCurrency(discountAmount, shopData?.currency)}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
                <span className="font-medium">Итого</span>
                <span className="font-mono-nums font-bold text-lg text-primary glow-text">
                  {formatCurrency(total, shopData?.currency)}
                </span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={createSale.isPending}
                className="w-full py-4 rounded-[18px] bg-primary font-semibold text-primary-foreground transition-all disabled:opacity-70 active:scale-[0.98]"
            >
              {showSuccess
                ? '✓ Продажа оформлена!'
                : isReservation
                  ? 'Оформить резерв'
                  : 'Оформить продажу'}
            </motion.button>
          </motion.div>
        )}

        {cart.length === 0 && (
          <div className="text-center py-16">
            <ShoppingCart size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeTab === 'search' ? 'Начните поиск, чтобы добавить товары' : 'Выберите товар из каталога'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function CatalogView({ inventory, onSelect, reservedFlavorIds }: { inventory: InventoryResponse; onSelect: (id: string) => void; reservedFlavorIds: Set<string> }) {
  const [path, setPath] = useState<(Category | Brand | ProductFormat)[]>([]); // [Category, Brand, Format]

  const currentLevel = path.length; // 0=Cat, 1=Brand, 2=Format, 3=Flavor

  const handleBack = () => setPath(prev => prev.slice(0, -1));

  const items = () => {
    if (currentLevel === 0) return inventory?.categories || [];
    if (currentLevel === 1) return inventory?.brands.filter((b) => b.categoryId === path[0].id) || [];
    if (currentLevel === 2) return inventory?.productFormats.filter((f) => f.brandId === path[1].id) || [];
    if (currentLevel === 3) {
      // Фильтруем товары: скрываем те, что в резервах, и показываем только с количеством > 0
      return inventory?.flavors.filter((f) => 
        f.productFormatId === path[2].id && 
        (f.quantity ?? 0) > 0 && 
        !reservedFlavorIds.has(f.id)
      ) || [];
    }
    return [];
  };

  const handleSelect = (item: Flavor | ProductFormat | Brand | Category) => {
    if (currentLevel === 3) {
      onSelect(item.id);
      setPath(prev => prev.slice(0, -1));
    } else {
      setPath(prev => [...prev, item as Category | Brand | ProductFormat]);
    }
  };

  return (
    <div className="h-[400px] flex flex-col border border-border rounded-xl overflow-hidden bg-background">
      {currentLevel > 0 && (
        <div className="flex items-center gap-2 p-3 border-b bg-secondary/50">
          <button
            onClick={handleBack}
            className="h-8 w-8 rounded-lg bg-background flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex gap-1 text-sm text-muted-foreground overflow-hidden">
            {path.map((p, i) => (
              <span key={i} className="flex items-center">
                {p.name} {i < path.length - 1 && <ChevronRight size={12} />}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2">
        {items().map((item) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center justify-between p-3 border-b last:border-0 hover:bg-secondary/50 text-left transition-colors rounded-lg mb-1"
          >
            <div className="flex items-center gap-2">
              {'emoji' in item && item.emoji && <span>{item.emoji}</span>}
              {'emojiPrefix' in item && item.emojiPrefix && <span>{item.emojiPrefix}</span>}
              <span className="text-sm">{item.name}</span>
            </div>
            {currentLevel === 3 ? (
              <Plus size={16} className="text-primary" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground" />
            )}
          </button>
        ))}
        {items().length === 0 && (
          <div className="text-center p-4 text-muted-foreground text-sm">Пусто</div>
        )}
      </div>
    </div>
  );
}
