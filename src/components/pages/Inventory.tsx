'use client';

import { useState, useRef, useCallback, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenHelpDialog } from '@/components/ScreenHelpDialog';
import { HELP_INVENTORY } from '@/lib/screen-help-content';
import { Search, Plus, Minus, ChevronDown, PackagePlus, ScanLine, Edit2, Filter, Folder, Tag, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { ScanModal } from '@/components/inventory/ScanModal';
import { EditItemModal } from '@/components/inventory/EditItemModal';
import { EditBrandModal } from '@/components/inventory/EditBrandModal';
import { ReceiveModal } from '@/components/inventory/ReceiveModal';
import { StockMovementsPanel } from '@/components/inventory/StockMovementsPanel';
import { FilterModal } from '@/components/inventory/FilterModal';
import { SellReservationModal } from '@/components/inventory/SellReservationModal';
import { CategoriesManager } from '@/components/inventory/CategoriesManager';
import { BrandsManager } from '@/components/inventory/BrandsManager';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useInventoryFilters } from '@/hooks/useInventoryFilters';
import { getCurrencySymbol } from '@/lib/currency';
import { filterDigitsOnly, parsePositiveInt } from '@/lib/numeric-input';

interface TreeItem {
  category: any;
  brand: any;
  format: any;
  flavor: any;
  quantity: number;
  postQuantity?: number;
  reservedQuantity: number;
  costPrice: number;
  barcode: string | null;
}

function InventoryBulkQtyPopover({
  flavorId,
  flavorName,
  quantity,
  pending,
  onApplyDelta,
}: {
  flavorId: string;
  flavorName: string;
  quantity: number;
  pending: boolean;
  onApplyDelta: (flavorId: string, delta: number) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = Math.min(999, Math.max(0, parsePositiveInt(raw, 0)));

  const run = async (sign: 1 | -1) => {
    const n = parsed;
    if (n < 1) {
      toast({
        title: 'Укажите число',
        description: 'Введите количество от 1 до 999',
        variant: 'destructive',
      });
      return;
    }
    if (sign < 0 && n > quantity) {
      toast({
        title: 'Слишком много',
        description: 'Нельзя списать больше, чем есть на остатке',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      await onApplyDelta(flavorId, sign * n);
      setOpen(false);
      setRaw('');
    } catch {
      // Ошибку показывает мутация updateStock
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setRaw('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg px-1 text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground active:scale-95 disabled:opacity-30"
          disabled={pending}
          title="Добавить или списать несколько штук за раз"
          aria-label={`Несколько штук: ${flavorName}`}
        >
          N
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,18rem)] p-3" align="end" sideOffset={6}>
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Несколько штук</p>
          <Label htmlFor={`bulk-qty-${flavorId}`} className="text-[11px] leading-snug text-muted-foreground">
            Сейчас: {quantity} шт. Укажите, сколько добавить или списать (1–999)
          </Label>
          <Input
            id={`bulk-qty-${flavorId}`}
            inputMode="numeric"
            autoComplete="off"
            className="h-9"
            value={raw}
            onChange={(e) => setRaw(filterDigitsOnly(e.target.value).slice(0, 3))}
            placeholder="10"
          />
          <div className="flex gap-2 pt-0.5">
            <Button type="button" size="sm" className="flex-1 rounded-[10px]" disabled={pending || busy} onClick={() => void run(1)}>
              Добавить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 rounded-[10px]"
              disabled={pending || busy || quantity === 0}
              onClick={() => void run(-1)}
            >
              Списать
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Inventory() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const { filters, hasActiveFilters } = useInventoryFilters();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  
  const [showReceive, setShowReceive] = useState(false);
  const [receiveInitialBarcode, setReceiveInitialBarcode] = useState<string | null>(null);
  
  const [showScan, setShowScan] = useState(false);
  const [scanMode, setScanMode] = useState<'receive' | 'search'>('search');
  
  const [editItem, setEditItem] = useState<TreeItem | null>(null);
  const [editBrandFormat, setEditBrandFormat] = useState<{ brand: any; format: any } | null>(null);
  const [sellingReservation, setSellingReservation] = useState<{ id: string; data?: any } | null>(null);
  const [showCategoriesManager, setShowCategoriesManager] = useState(false);
  const [showBrandsManager, setShowBrandsManager] = useState(false);
  const [autoOpenCategoryCreate, setAutoOpenCategoryCreate] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const pendingFlavorRef = useRef<Set<string>>(new Set());
  const [, bumpPendingUi] = useReducer((x: number) => x + 1, 0);
  const [reservePickList, setReservePickList] = useState<any[] | null>(null);

  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['inventory', search, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('search', search);
      params.set('inStockOnly', filters.inStockOnly ? '1' : '0');
      params.set('noBarcode', filters.noBarcode ? '1' : '0');
      params.set('showReservedOnly', filters.showReservedOnly ? '1' : '0');
      params.set('includeInactive', filters.includeInactive ? '1' : '0');
      if (filters.selectedCategory) params.set('categoryId', filters.selectedCategory);
      if (filters.selectedStrength) params.set('strength', filters.selectedStrength);
      if (filters.selectedBrand) params.set('brandId', filters.selectedBrand);
      if (filters.selectedColor) params.set('color', filters.selectedColor);
      if (filters.minPrice) params.set('minPrice', filters.minPrice);
      if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
      return api<{
        items: TreeItem[]; // Flat list
        tree: TreeItem[]; // Legacy support if needed, but we use flat list to build tree
        flavors: any[];
        productFormats: any[];
        brands: any[];
        categories: any[];
      }>(`/api/inventory?${params.toString()}`);
    },
  });

  const updateStock = useMutation({
    mutationFn: (payload: {
      flavorId: string;
      quantity: number;
      postQuantity?: number;
      actionType?: string;
      comment?: string;
    }) => api('/api/inventory/stock', { method: 'PATCH', body: payload }),
    onSuccess: (_, variables) => {
      // Инвалидируем все запросы инвентаря (с фильтрами и без)
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      
      // Находим товар для информационного сообщения
      const item = data?.items.find((t) => t.flavor.id === variables.flavorId);
      if (item) {
        const brandName = item.brand?.name || '';
        const formatName = item.format?.name || '';
        const flavorName = item.flavor?.name || '';
        
        toast({
          title: "Количество обновлено",
          description: `Товар ${brandName} ${formatName} ${flavorName}: ${variables.quantity} шт`,
          duration: 2000,
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка обновления",
        description: err.message || "Не удалось обновить количество",
        variant: 'destructive',
      });
    },
  });


  const toggleFormat = (id: string) => {
    setExpandedFormats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateQuantity = useCallback(
    async (flavorId: string, delta: number) => {
      if (pendingFlavorRef.current.has(flavorId)) return;
      const item = data?.items.find((t) => t.flavor.id === flavorId);
      if (!item) return;
      const newQty = Math.max(0, item.quantity + delta);
      pendingFlavorRef.current.add(flavorId);
      bumpPendingUi();
      try {
        await updateStock.mutateAsync({
          flavorId,
          quantity: newQty,
          actionType: delta > 0 ? 'receipt_to_warehouse' : 'manual_decrease',
          comment: delta > 0 ? 'Ручное пополнение остатка' : 'Ручное уменьшение остатка',
        });
      } finally {
        pendingFlavorRef.current.delete(flavorId);
        bumpPendingUi();
      }
    },
    [data?.items, updateStock]
  );

  const openSellReservation = useCallback((reservation: any) => {
    setSellingReservation({
      id: reservation.id,
      data: {
        reservationCustomerName: reservation.reservationCustomerName,
        reservationExpiry: reservation.reservationExpiry,
        finalAmount: reservation.finalAmount,
      },
    });
  }, []);

  const handleReserveSellClick = useCallback(
    async (flavorId: string) => {
      try {
        const res = await api<any[]>(`/api/reservations/by-flavor/${flavorId}`);
        if (!res?.length) return;
        if (res.length === 1) {
          openSellReservation(res[0]);
          return;
        }
        const sorted = [...res].sort(
          (a, b) =>
            new Date(a.reservationExpiry ?? 0).getTime() - new Date(b.reservationExpiry ?? 0).getTime()
        );
        setReservePickList(sorted);
      } catch {
        toast({
          title: 'Не удалось загрузить резервы',
          variant: 'destructive',
        });
      }
    },
    [openSellReservation, toast]
  );

  const items = Array.isArray(data?.items) ? data.items : [];
  const flavors = Array.isArray(data?.flavors) ? data.flavors : [];
  const productFormats = Array.isArray(data?.productFormats) ? data.productFormats : [];
  const brands = Array.isArray(data?.brands) ? data.brands : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];

  // Get unique strength values from formats, normalize "мг" to "mg"
  const uniqueStrengths = [
    ...new Set(
      productFormats
        .map((f: any) => {
          const label = f.strengthLabel || '';
          // Normalize "мг" to "mg"
          return label.replace(/мг/gi, 'mg').trim();
        })
        .filter((s: string) => s)
    ),
  ].sort();

  // Get unique colors from flavors for device categories
  // Colors are stored in flavor.name for devices
  const deviceCategories = categories.filter((c: any) => {
    const name = c.name?.toLowerCase() || '';
    return (
      name.includes('устройств') ||
      name.includes('device') ||
      name.includes('pod') ||
      name.includes('мод')
    );
  });
  
  const uniqueColors = deviceCategories.length > 0
    ? [
        ...new Set(
          items
            .filter((item: TreeItem) => 
              deviceCategories.some((dc: any) => dc.id === item.category.id)
            )
            .map((item: TreeItem) => item.flavor.name.trim())
            .filter((color: string) => color)
        ),
      ].sort()
    : [];


  // Group items for display
  const grouped = items.reduce((acc: Record<string, TreeItem[]>, t) => {
    const key = t.format.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const handleScan = (code: string) => {
    if (scanMode === 'receive') {
      setReceiveInitialBarcode(code);
      setShowReceive(true);
    } else {
      setSearch(code);
      toast({ title: "Поиск по штрихкоду", description: code });
    }
  };

  const totalItems = items.reduce((s, t) => s + t.quantity, 0);

  if (isLoading && !data) {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <ScreenHeader
          title="Склад"
          subtitle="Загрузка..."
          actions={<ScreenHelpDialog help={HELP_INVENTORY} />}
        />
        <div className="w-full min-w-0 px-4 py-8 text-center text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="flex w-full min-w-0 flex-col">
        <ScreenHeader
          title="Склад"
          subtitle="Ошибка загрузки"
          actions={<ScreenHelpDialog help={HELP_INVENTORY} />}
        />
        <div className="w-full min-w-0 space-y-4 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Не удалось загрузить склад'}
          </p>
          <Button type="button" onClick={() => refetch()} className="rounded-[12px]">
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  const activeFiltersCount = [
    filters.inStockOnly,
    filters.noBarcode,
    filters.showReservedOnly,
    filters.includeInactive,
    filters.selectedCategory !== null,
    filters.selectedStrength !== null,
    filters.selectedBrand !== null,
    filters.selectedColor !== null,
    filters.minPrice !== '',
    filters.maxPrice !== '',
  ].filter(Boolean).length;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <ScreenHeader
        title="Склад"
        subtitle={`${totalItems} единиц на складе`}
        actions={<ScreenHelpDialog help={HELP_INVENTORY} />}
      />

      <div className="w-full min-w-0 space-y-4 px-5 pb-[max(10rem,calc(6.5rem+env(safe-area-inset-bottom,0px)))]">
        {isError && data && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm">
            <span className="text-muted-foreground flex-1">
              Не удалось обновить данные склада. Показано последнее сохранённое состояние.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Повторить
            </Button>
          </div>
        )}
        {items.length === 0 && !search && !hasActiveFilters && (
          <div className="p-4 border border-dashed border-primary/30 rounded-xl bg-primary/5 text-center space-y-2">
            <p className="text-sm font-medium">Ваш склад пуст</p>
            <p className="text-xs text-muted-foreground">Добавьте товары через раздел «Приём товара» в меню приложения.</p>
          </div>
        )}

        {/* Search */}
        <section className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-24 py-4 rounded-[18px] bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[0.9375rem]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setScanMode('search'); setShowScan(true); }}
              className="p-2 hover:bg-muted rounded-[10px] transition-colors"
              aria-label="Сканер штрихкода"
              title="Сканер"
            >
              <ScanLine size={20} className="text-primary" strokeWidth={1.5} />
            </button>
          </div>
        </section>

        {/* Action Buttons: Категории, Бренды, Фильтры */}
        <section className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCategoriesManager(true)}
            className="rounded-[12px]"
          >
            <Folder size={14} className="mr-1.5" />
            Категории
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBrandsManager(true)}
            className="rounded-[12px]"
          >
            <Tag size={14} className="mr-1.5" />
            Бренды
          </Button>
          <div className="relative">
            <Button
              variant={hasActiveFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilterModal(true)}
              className="rounded-[12px]"
            >
              <Filter size={14} className="mr-1.5" />
              Фильтры
            </Button>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
        </section>

        {/* Приём товара - primary full-width button */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => setShowReceive(true)}
              className="h-12 rounded-[18px] font-semibold"
              aria-label="Приём товара на склад"
            >
              <PackagePlus size={20} strokeWidth={1.5} className="mr-2" aria-hidden />
              Приём товара
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMovements(true)}
              className="h-12 rounded-[18px] font-semibold"
              aria-label="Открыть историю движений остатков"
            >
              История движений
            </Button>
          </div>
        </section>

        <section className="min-w-0 space-y-6 pb-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Загрузка...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p className="mb-2">Склад пуст</p>
              <Button
                onClick={() => setShowReceive(true)}
                className="gradient-primary text-primary-foreground"
              >
                <PackagePlus size={16} className="mr-2" />
                Принять первый товар
              </Button>
            </div>
          ) : (
            categories.map((cat: any) => {
              const catFormats = productFormats
                .filter((f: any) => brands.find((b: any) => b.id === f.brandId)?.categoryId === cat.id)
                .sort((a: any, b: any) => {
                  const brandA = brands.find((br: any) => br.id === a.brandId);
                  const brandB = brands.find((br: any) => br.id === b.brandId);
                  if (!brandA || !brandB) return 0;
                  // Сначала по sortOrder, потом по name
                  if (brandA.sortOrder !== brandB.sortOrder) {
                    return (brandA.sortOrder || 0) - (brandB.sortOrder || 0);
                  }
                  return brandA.name.localeCompare(brandB.name);
                });
              
              if (catFormats.length === 0) return null;

            return (
              <motion.div key={cat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span className="text-2xl">{cat.emoji}</span>
                  <h3 className="text-foreground font-semibold text-lg">{cat.name}</h3>
                </div>
                <div className="space-y-3">
                {catFormats.map((format: any) => {
                  const formatItems = grouped[format.id] ?? [];
                  const isExpanded = expandedFormats.has(format.id) || !!search;
                  const totalQty = formatItems.reduce((s, t) => s + t.quantity, 0);
                  const brand = brands.find((b: any) => b.id === format.brandId);
                  
                  const formatInactive = format.isActive === false;
                  return (
                    <div
                      key={format.id}
                      className={`bg-card rounded-[20px] overflow-hidden border ${
                        formatInactive ? 'border-amber-500/35 ring-1 ring-amber-500/15' : 'border-border'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-3 px-5 py-4 ${
                          formatInactive ? 'bg-amber-500/[0.06]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFormat(format.id)}
                          className="flex-1 flex items-center gap-3 text-left"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} линейку ${format.name ?? ''}`}
                        >
                          <span className="text-xl">{brand?.emojiPrefix}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-semibold text-sm ${
                                  formatInactive ? 'text-muted-foreground' : 'text-foreground'
                                }`}
                              >
                                {format.name}
                              </span>
                              {formatInactive && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-950 dark:text-amber-100">
                                  <EyeOff size={12} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
                                  Линейка вне каталога
                                </span>
                              )}
                              {format.strengthLabel && (
                                <>
                                  <span className="text-muted-foreground text-xs">•</span>
                                  <span className="text-muted-foreground text-xs">{format.strengthLabel}</span>
                                </>
                              )}
                              <span className="text-muted-foreground text-xs">•</span>
                              <span className="text-primary text-sm font-semibold">{format.unitPrice} {getCurrencySymbol(shopData?.currency)}</span>
                              <span className="text-muted-foreground text-xs">•</span>
                              <span className="text-foreground text-sm">{totalQty} шт</span>
                              {formatItems.reduce((s, t) => s + (t.reservedQuantity ?? 0), 0) > 0 && (
                                <>
                                  <span className="text-muted-foreground text-xs">•</span>
                                  <span className="text-muted-foreground text-xs">(резерв: {formatItems.reduce((s, t) => s + (t.reservedQuantity ?? 0), 0)})</span>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`text-muted-foreground transition-transform flex-shrink-0 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            strokeWidth={1.5}
                          />
                        </button>
                        {brand && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditBrandFormat({ brand, format });
                            }}
                            className="p-2 hover:bg-muted rounded-[10px] transition-colors flex-shrink-0"
                            aria-label={`Редактировать линейку ${format.name ?? ''}`}
                            title="Редактировать бренд (линейку)"
                          >
                            <Edit2 size={18} className="text-muted-foreground" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key={`${format.id}-body`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="border-t border-border/25 bg-background"
                          >
                            <div className="space-y-2 px-5 py-2.5">
                              {formatItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">
                                  Нет вкусов или нет строк по текущим фильтрам. Отредактируйте бренд кнопкой справа или примите товар.
                                </p>
                              ) : (
                              formatItems.map((t) => {
                                const notInCatalog =
                                  t.flavor.isActive === false || (t.format?.isActive === false);
                                const hiddenByFlavor = t.flavor.isActive === false;
                                const hiddenByFormat = t.format?.isActive === false;
                                return (
                                <div
                                  key={t.flavor.id}
                                  className="border-b border-border/30 last:border-0 pb-2.5 last:pb-0"
                                >
                                  <div
                                    className={`min-w-0 space-y-1 ${
                                      notInCatalog
                                        ? 'rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-2 py-1.5 sm:px-2.5'
                                        : ''
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                      <h4
                                        className={`break-words text-sm font-medium ${
                                          notInCatalog ? 'text-muted-foreground' : 'text-foreground'
                                        }`}
                                      >
                                        {t.flavor.name}
                                      </h4>
                                      {!t.barcode && (
                                        <span className="shrink-0 rounded-full bg-destructive/20 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                                          Без штрихкода
                                        </span>
                                      )}
                                      {notInCatalog && (
                                        <span
                                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/45 bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-950 dark:text-amber-100"
                                          title={
                                            hiddenByFlavor && hiddenByFormat
                                              ? 'Вкус и линейка выключены в каталоге'
                                              : hiddenByFormat
                                                ? 'Линейка выключена — все вкусы не в продаже'
                                                : 'Этот вкус выключен в каталоге'
                                          }
                                        >
                                          <EyeOff size={12} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
                                          Вне каталога
                                          {hiddenByFlavor && hiddenByFormat
                                            ? ' (вкус+линейка)'
                                            : hiddenByFormat
                                              ? ' (линейка)'
                                              : ' (вкус)'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                                      <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                                        Себестоимость {t.costPrice} {getCurrencySymbol(shopData?.currency)} · Цена{' '}
                                        {t.format?.unitPrice ?? format.unitPrice} {getCurrencySymbol(shopData?.currency)}
                                      </p>
                                      <div
                                        className="flex shrink-0 touch-manipulation items-center rounded-xl border border-border/50 bg-muted/30 p-0.5 shadow-sm"
                                        role="group"
                                        aria-label={`Остаток и действия: ${t.flavor.name}`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setEditItem(t)}
                                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground active:scale-95"
                                          aria-label={`Редактировать товар ${t.flavor.name}`}
                                        >
                                          <Edit2 size={15} strokeWidth={1.5} />
                                        </button>
                                        <span className="mx-0.5 h-5 w-px shrink-0 bg-border/60" aria-hidden />
                                        <button
                                          type="button"
                                          onClick={() => updateQuantity(t.flavor.id, -1)}
                                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-background/90 active:scale-95 disabled:opacity-30"
                                          disabled={t.quantity === 0 || pendingFlavorRef.current.has(t.flavor.id)}
                                          aria-label={`Уменьшить остаток: ${t.flavor.name}`}
                                        >
                                          <Minus size={16} className="text-destructive" strokeWidth={2} />
                                        </button>
                                        <span
                                          className={`min-w-[1.75rem] px-0.5 text-center font-mono text-sm font-bold tabular-nums ${
                                            t.quantity === 0
                                              ? 'text-destructive'
                                              : t.quantity <= 2
                                                ? 'text-muted-foreground'
                                                : 'text-foreground'
                                          }`}
                                        >
                                          {t.quantity}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateQuantity(t.flavor.id, 1)}
                                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-background/90 active:scale-95"
                                          disabled={pendingFlavorRef.current.has(t.flavor.id)}
                                          aria-label={`Увеличить остаток: ${t.flavor.name}`}
                                        >
                                          <Plus size={16} className="text-primary" strokeWidth={2} />
                                        </button>
                                        <span className="mx-0.5 h-5 w-px shrink-0 bg-border/60" aria-hidden />
                                        <InventoryBulkQtyPopover
                                          flavorId={t.flavor.id}
                                          flavorName={t.flavor.name}
                                          quantity={t.quantity}
                                          pending={pendingFlavorRef.current.has(t.flavor.id)}
                                          onApplyDelta={updateQuantity}
                                        />
                                      </div>
                                    </div>
                                    {t.reservedQuantity > 0 && (
                                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <span className="text-[11px] text-muted-foreground">Резерв {t.reservedQuantity} шт</span>
                                        <button
                                          type="button"
                                          onClick={() => handleReserveSellClick(t.flavor.id)}
                                          className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/25"
                                        >
                                          Продать
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                );
                              })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                </div>
              </motion.div>
            );
          })
          )}
        </section>
      </div>

      <ReceiveModal 
        open={showReceive} 
        onOpenChange={(nextOpen) => {
          setShowReceive(nextOpen);
          if (!nextOpen) setReceiveInitialBarcode(null);
        }}
        initialBarcode={receiveInitialBarcode}
        onOpenCategoryManager={() => {
          setShowReceive(false);
          setAutoOpenCategoryCreate(true);
          setShowCategoriesManager(true);
        }}
      />

      <ScanModal 
        open={showScan} 
        onOpenChange={setShowScan} 
        onScan={handleScan} 
      />
      
      <EditItemModal 
        open={!!editItem} 
        onOpenChange={(open) => !open && setEditItem(null)} 
        item={editItem} 
      />
      
      <EditBrandModal
        open={!!editBrandFormat}
        onOpenChange={(open) => !open && setEditBrandFormat(null)}
        brand={editBrandFormat?.brand || null}
        format={editBrandFormat?.format || null}
        categories={categories}
        brands={brands}
      />

      <FilterModal
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        categories={categories}
        strengths={uniqueStrengths}
        brands={brands}
        colors={uniqueColors}
      />

      {sellingReservation && (
        <SellReservationModal
          open={!!sellingReservation}
          onOpenChange={(open) => !open && setSellingReservation(null)}
          reservationId={sellingReservation.id}
          reservationData={sellingReservation.data}
        />
      )}

      <Dialog open={!!reservePickList?.length} onOpenChange={(o) => !o && setReservePickList(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Выберите резерв</DialogTitle>
            <DialogDescription>
              На этот вкус несколько активных резервов. Укажите, какой провести в продажу.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 py-1">
            {reservePickList?.map((r) => (
              <button
                key={r.id}
                type="button"
                className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/80 space-y-1 transition-colors"
                onClick={() => {
                  const picked = r;
                  setReservePickList(null);
                  openSellReservation(picked);
                }}
              >
                <div className="text-sm font-medium">{r.reservationCustomerName?.trim() || 'Без имени клиента'}</div>
                <div className="text-xs text-muted-foreground">
                  Срок: {r.reservationExpiry ? new Date(r.reservationExpiry).toLocaleString() : '—'} · Сумма:{' '}
                  {r.finalAmount != null ? `${r.finalAmount} ${getCurrencySymbol(shopData?.currency)}` : '—'}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setReservePickList(null)}>
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories Manager Modal */}
      <Dialog open={showCategoriesManager} onOpenChange={setShowCategoriesManager}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Управление категориями</DialogTitle>
            <DialogDescription>
              Создавайте, редактируйте и удаляйте категории товаров
            </DialogDescription>
          </DialogHeader>
          <CategoriesManager autoOpenCreate={autoOpenCategoryCreate} onCreateComplete={() => setAutoOpenCategoryCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Brands Manager Modal */}
      <Dialog open={showBrandsManager} onOpenChange={setShowBrandsManager}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Управление порядком брендов</DialogTitle>
            <DialogDescription>
              Изменяйте порядок брендов внутри каждой категории
            </DialogDescription>
          </DialogHeader>
          <BrandsManager />
        </DialogContent>
      </Dialog>

      <Dialog open={showMovements} onOpenChange={setShowMovements}>
        <DialogContent className="max-w-[96vw] sm:max-w-6xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>История движений</DialogTitle>
            <DialogDescription>
              Журнал всех изменений остатков по товарам
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4 overflow-auto">
            <StockMovementsPanel items={items} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
