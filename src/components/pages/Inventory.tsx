'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Search, Plus, Minus, ChevronRight, ChevronDown, PackagePlus, ScanLine, Edit2, Filter, ShoppingCart, Folder, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { ScanModal } from '@/components/inventory/ScanModal';
import { EditItemModal } from '@/components/inventory/EditItemModal';
import { EditBrandModal } from '@/components/inventory/EditBrandModal';
import { ReceiveModal } from '@/components/inventory/ReceiveModal';
import { FilterModal } from '@/components/inventory/FilterModal';
import { SellReservationModal } from '@/components/inventory/SellReservationModal';
import { CategoriesManager } from '@/components/inventory/CategoriesManager';
import { BrandsManager } from '@/components/inventory/BrandsManager';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useInventoryFilters } from '@/hooks/useInventoryFilters';
import { getCurrencySymbol } from '@/lib/currency';

interface TreeItem {
  category: any;
  brand: any;
  format: any;
  flavor: any;
  quantity: number;
  reservedQuantity: number;
  costPrice: number;
  barcode: string | null;
}

export function Inventory() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const { filters, hasActiveFilters } = useInventoryFilters();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  
  const [showReceive, setShowReceive] = useState(false);
  
  const [showScan, setShowScan] = useState(false);
  const [scanMode, setScanMode] = useState<'receive' | 'search'>('search');
  
  const [editItem, setEditItem] = useState<TreeItem | null>(null);
  const [editBrandFormat, setEditBrandFormat] = useState<{ brand: any; format: any } | null>(null);
  const [sellingReservation, setSellingReservation] = useState<{ id: string; data?: any } | null>(null);
  const [showCategoriesManager, setShowCategoriesManager] = useState(false);
  const [showBrandsManager, setShowBrandsManager] = useState(false);
  const [autoOpenCategoryCreate, setAutoOpenCategoryCreate] = useState(false);

  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', search, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('search', search);
      params.set('inStockOnly', filters.inStockOnly ? '1' : '0');
      params.set('noBarcode', filters.noBarcode ? '1' : '0');
      params.set('showReservedOnly', filters.showReservedOnly ? '1' : '0');
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
    mutationFn: (payload: { flavorId: string; quantity: number }) =>
      api('/api/inventory/stock', { method: 'PATCH', body: payload }),
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

  const updateQuantity = (flavorId: string, delta: number) => {
    const item = data?.items.find((t) => t.flavor.id === flavorId);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    updateStock.mutate({ flavorId, quantity: newQty });
  };

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
      // This mode is now handled inside ReceiveModal, but if triggered from main screen:
      setShowReceive(true);
      // Ideally we pass the code to ReceiveModal, but for now just open it
    } else {
      setSearch(code);
      toast({ title: "Поиск по штрихкоду", description: code });
    }
  };

  const totalItems = items.reduce((s, t) => s + t.quantity, 0);

  if (isLoading) {
    return (
      <>
        <ScreenHeader title="Склад" subtitle="Загрузка..." />
        <div className="px-4 py-8 text-center text-muted-foreground">Загрузка...</div>
      </>
    );
  }

  const activeFiltersCount = [
    filters.inStockOnly,
    filters.noBarcode,
    filters.showReservedOnly,
    filters.selectedCategory !== null,
    filters.selectedStrength !== null,
    filters.selectedBrand !== null,
    filters.selectedColor !== null,
    filters.minPrice !== '',
    filters.maxPrice !== '',
  ].filter(Boolean).length;

  return (
    <>
      <ScreenHeader title="Склад" subtitle={`${totalItems} единиц на складе`} />

      <div className="px-5 space-y-4">
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
              onClick={() => { setScanMode('search'); setShowScan(true); }}
              className="p-2 hover:bg-muted rounded-[10px] transition-colors"
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
          <Button
            onClick={() => setShowReceive(true)}
            className="w-full h-12 rounded-[18px] font-semibold"
          >
            <PackagePlus size={20} strokeWidth={1.5} className="mr-2" />
            Приём товара
          </Button>
        </section>

        <section className="space-y-6 pb-20">
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
                  
                  return (
                    <div key={format.id} className="bg-card rounded-[20px] overflow-hidden border border-border">
                      <div className="flex items-center gap-3 px-5 py-4">
                        <button
                          onClick={() => toggleFormat(format.id)}
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <span className="text-xl">{brand?.emojiPrefix}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-foreground font-semibold text-sm">{format.name}</span>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditBrandFormat({ brand, format });
                            }}
                            className="p-2 hover:bg-muted rounded-[10px] transition-colors flex-shrink-0"
                            title="Редактировать бренд (линейку)"
                          >
                            <Edit2 size={18} className="text-muted-foreground" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-background"
                          >
                            <div className="px-5 py-3 space-y-3">
                              {formatItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">
                                  Нет вкусов или нет строк по текущим фильтрам. Отредактируйте бренд кнопкой справа или примите товар.
                                </p>
                              ) : (
                              formatItems.map((t) => (
                                <div
                                  key={t.flavor.id}
                                  className="border-b border-border/30 last:border-0 pb-3 last:pb-0"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-foreground text-sm font-medium">{t.flavor.name}</h4>
                                        {!t.barcode && (
                                          <span className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs rounded-full">
                                            No Barcode
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>Себест: {t.costPrice}{getCurrencySymbol(shopData?.currency)}</span>
                                        <span>•</span>
                                        <span>Цена: {t.format?.unitPrice ?? format.unitPrice}{getCurrencySymbol(shopData?.currency)}</span>
                                      </div>
                                      {t.reservedQuantity > 0 && (
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-xs text-muted-foreground">Резерв: {t.reservedQuantity} шт</span>
                                          <button
                                            onClick={async () => {
                                              const res = await api<any[]>(`/api/reservations/by-flavor/${t.flavor.id}`);
                                              if (res && res.length > 0) {
                                                const reservation = res[0];
                                                setSellingReservation({
                                                  id: reservation.id,
                                                  data: {
                                                    reservationCustomerName: reservation.reservationCustomerName,
                                                    reservationExpiry: reservation.reservationExpiry,
                                                    finalAmount: reservation.finalAmount,
                                                  },
                                                });
                                              }
                                            }}
                                            className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-[8px] hover:bg-primary/30 transition-colors"
                                          >
                                            Продать
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditItem(t)}
                                        className="p-2 bg-card rounded-[10px] hover:bg-muted transition-colors"
                                      >
                                        <Edit2 size={14} className="text-muted-foreground" strokeWidth={1.5} />
                                      </button>
                                      <button
                                        onClick={() => updateQuantity(t.flavor.id, -1)}
                                        className="p-2 bg-card rounded-[10px] active:scale-95 transition-transform disabled:opacity-30"
                                        disabled={t.quantity === 0}
                                      >
                                        <Minus size={14} className="text-destructive" strokeWidth={2} />
                                      </button>
                                      <span
                                        className={`font-mono font-bold text-base min-w-[2.5rem] text-center ${
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
                                        onClick={() => updateQuantity(t.flavor.id, 1)}
                                        className="p-2 bg-card rounded-[10px] active:scale-95 transition-transform"
                                      >
                                        <Plus size={14} className="text-primary" strokeWidth={2} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
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
        onOpenChange={setShowReceive}
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
    </>
  );
}
