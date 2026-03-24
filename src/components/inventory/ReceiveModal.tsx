'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Minus, ScanLine, PackagePlus, ChevronRight, ChevronDown, ArrowLeft, Check, X, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ScanModal } from './ScanModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

interface ReceiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCategoryManager?: () => void;
}

interface ReceiveItem {
  flavorId: string;
  name: string;
  formatName: string;
  brandEmoji: string;
  currentQty: number;
  addQty: number;
  formatStrengthLabel?: string;
  formatUnitPrice?: number;
  customCostPrice?: number;
}

// Функция проверки похожести строк
function areSimilar(str1: string, str2: string): boolean {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return true;
  if (str1.toLowerCase() === str2.toLowerCase()) return true;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return false;
  if (Math.abs(len1 - len2) > 2) return false;
  
  if (s1.includes(s2) || s2.includes(s1)) {
    const diff = Math.abs(len1 - len2);
    if (diff <= 2) return true;
  }
  
  let differences = 0;
  const minLen = Math.min(len1, len2);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] !== s2[i]) differences++;
  }
  differences += Math.abs(len1 - len2);
  
  return differences <= 2;
}

/** Омы и доп. числовое поле: скобки в вводе, запятая, «.8», суффиксы Ω — нормализуем (часто с Android). */
function normalizeDecimalNumericInput(raw: string): { ok: true; normalized: string } | { ok: false } {
  let s = raw.trim();
  if (!s) return { ok: false };
  while (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[ΩΩ]|ohm|\bом\b/gi, '').trim();
  const commaCount = (s.match(/,/g) || []).length;
  if (commaCount === 1 && !s.includes('.')) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  if (s.startsWith('.')) s = `0${s}`;
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, normalized: s };
}

export function ReceiveModal({ open, onOpenChange, onOpenCategoryManager }: ReceiveModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('scan');
  const [scanInput, setScanInput] = useState('');
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [showScanCamera, setShowScanCamera] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  
  // New Item Creation State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<any>('/api/inventory'),
    enabled: open,
  });

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });

  const updateStock = useMutation({
    mutationFn: (payload: { flavorId: string; quantity: number; costPrice?: number }) =>
      api('/api/inventory/stock', { method: 'PATCH', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка обновления',
        description: err.message || 'Не удалось обновить остаток',
        variant: 'destructive',
      });
    },
  });

  // Focus input when tab changes or modal opens
  useEffect(() => {
    if (open && activeTab === 'scan') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, activeTab]);

  // Auto-process barcode when input changes (for scanner input)
  useEffect(() => {
    if (!scanInput || !open || activeTab !== 'scan') return;

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    scanTimeoutRef.current = setTimeout(() => {
      processBarcode(scanInput);
    }, 300);

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanInput, open, activeTab]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcode(scanInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      e.preventDefault();
      processBarcode(scanInput);
    }
  };

  const processBarcode = (code: string) => {
    if (!code.trim()) return;
    
    const trimmedCode = code.trim();
    
    const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];
    const foundByBarcode = flavors.find((f: any) => f.barcode === trimmedCode);
    
    if (foundByBarcode) {
      addItemToReceive(foundByBarcode.id);
      setScanInput('');
      setNotFoundBarcode(null);
      toast({ 
        title: "Товар принят", 
        description: `${foundByBarcode.name} (+1)`,
        duration: 2000
      });
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    setNotFoundBarcode(trimmedCode);
    setScanInput('');
    toast({ 
      title: "Товар не найден", 
      description: `Штрихкод: ${trimmedCode}`,
      variant: "destructive",
      duration: 3000
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const addItemToReceive = (flavorId: string) => {
    const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];
    const productFormats = Array.isArray(inventory?.productFormats) ? inventory.productFormats : [];
    const brands = Array.isArray(inventory?.brands) ? inventory.brands : [];
    
    const flavor = flavors.find((f: any) => f.id === flavorId);
    if (!flavor) return;
    
    const format = productFormats.find((pf: any) => pf.id === flavor.productFormatId);
    const brand = brands.find((b: any) => b.id === format?.brandId);

    setReceiveItems(prev => {
      const existing = prev.find(i => i.flavorId === flavorId);
      if (existing) {
        return prev.map(i => i.flavorId === flavorId ? { ...i, addQty: i.addQty + 1 } : i);
      }
      return [...prev, {
        flavorId,
        name: flavor.name,
        formatName: format?.name || '',
        brandEmoji: brand?.emojiPrefix || '',
        currentQty: flavor.quantity,
        addQty: 1,
        formatStrengthLabel: format?.strengthLabel || '',
        formatUnitPrice: format?.unitPrice || 0
      }];
    });
  };

  const confirmReceive = async () => {
    try {
      if (receiveItems.some((ri) => ri.customCostPrice != null && ri.customCostPrice < 0)) {
        toast({
          title: 'Ошибка',
          description: 'Закупочная цена не может быть отрицательной',
          variant: 'destructive',
        });
        return;
      }

      const itemsDetails: string[] = [];
      const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];
      const productFormats = Array.isArray(inventory?.productFormats) ? inventory.productFormats : [];
      const brands = Array.isArray(inventory?.brands) ? inventory.brands : [];
      
      for (const ri of receiveItems) {
        const payload: { flavorId: string; quantity: number; costPrice?: number } = {
          flavorId: ri.flavorId,
          quantity: ri.currentQty + ri.addQty,
        };
        if (ri.customCostPrice != null && ri.customCostPrice > 0) {
          payload.costPrice = ri.customCostPrice;
        }
        await updateStock.mutateAsync(payload);
        
        // Формируем детальное сообщение для каждого товара
        const flavor = flavors.find((f: any) => f.id === ri.flavorId);
        const format = flavor ? productFormats.find((pf: any) => pf.id === flavor.productFormatId) : null;
        const brand = format ? brands.find((b: any) => b.id === format.brandId) : null;
        
        const brandName = brand?.name || '';
        const formatName = ri.formatName || format?.name || '';
        const flavorName = ri.name || '';
        
        itemsDetails.push(`Товар ${brandName} ${formatName} ${flavorName} добавлен на склад (${ri.addQty} шт)`);
      }
      
      const totalQty = receiveItems.reduce((s, i) => s + i.addQty, 0);
      setReceiveItems([]);
      setNotFoundBarcode(null);
      onOpenChange(false);
      
      // Показываем общее сообщение и детали для каждого товара
      toast({ 
        title: "Товары приняты на склад", 
        description: `Принято ${totalQty} единиц. ${itemsDetails.join('. ')}`,
        duration: 5000,
      });
    } catch (e) {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];
  const productFormats = Array.isArray(inventory?.productFormats) ? inventory.productFormats : [];
  const brands = Array.isArray(inventory?.brands) ? inventory.brands : [];
  const searchResults = scanInput.length >= 2 && !showCreateForm && !notFoundBarcode
    ? flavors.filter((f: any) => {
        const format = productFormats.find((pf: any) => pf.id === f.productFormatId);
        const brand = brands.find((b: any) => b.id === format?.brandId);
        const combined = `${brand?.name || ''} ${format?.name || ''} ${f.name} ${f.barcode || ''}`.toLowerCase();
        return combined.includes(scanInput.toLowerCase());
      }).slice(0, 5)
    : [];

  const handleCreateFromNotFound = () => {
    setNewBarcode(notFoundBarcode || '');
    setNotFoundBarcode(null);
    setShowCreateForm(true);
  };

  if (showCreateForm) {
    return (
      <CreateItemForm 
        barcode={newBarcode} 
        onClose={() => { setShowCreateForm(false); setScanInput(''); setNotFoundBarcode(null); }}
        onSuccess={(flavorId, details) => {
          setShowCreateForm(false);
          setScanInput('');
          setNotFoundBarcode(null);
          addItemToReceive(flavorId);
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
          
          if (details) {
            toast({ 
              title: "Товар создан и добавлен", 
              description: `Товар ${details.brandName} ${details.formatName} ${details.flavorName} добавлен на склад (${details.quantity} шт)`,
              duration: 4000,
            });
          } else {
            toast({ title: "Товар создан и добавлен", description: "Можете продолжать сканирование" });
          }
          
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        inventory={inventory}
        onOpenCategoryManager={onOpenCategoryManager}
      />
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus size={20} className="text-primary" />
              Приём товара
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setNotFoundBarcode(null); }} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scan">Сканирование</TabsTrigger>
                <TabsTrigger value="catalog">Каталог</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="scan" className="flex-1 flex flex-col overflow-hidden mt-0 p-0">
              <div className="p-4 space-y-4">
                <form onSubmit={handleScanSubmit} className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      ref={inputRef}
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Сканируйте штрихкод..."
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowScanCamera(true)}>
                    <ScanLine size={18} />
                  </Button>
                </form>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewBarcode('');
                    setShowCreateForm(true);
                  }}
                  className="w-full"
                >
                  <Plus size={16} className="mr-2" />
                  Добавить новый товар
                </Button>

                {notFoundBarcode && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive mb-1">Товар не найден</p>
                        <p className="text-xs text-muted-foreground mb-3">Штрихкод: {notFoundBarcode}</p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleCreateFromNotFound}
                          className="w-full"
                        >
                          <Plus size={14} className="mr-2" />
                          Добавить товар на склад
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {searchResults && searchResults.length > 0 && !notFoundBarcode && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border rounded-xl overflow-hidden bg-background"
                  >
                    {searchResults.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => { addItemToReceive(f.id); setScanInput(''); }}
                        className="w-full text-left p-2 hover:bg-secondary flex justify-between items-center border-b last:border-0"
                      >
                        <span className="text-sm">{f.name}</span>
                        <Plus size={14} />
                      </button>
                    ))}
                  </motion.div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[40vh]">
                  {receiveItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {notFoundBarcode 
                        ? 'Сканируйте следующий товар или добавьте не найденный'
                        : 'Сканируйте товары или выберите из каталога'}
                    </div>
                  ) : (
                    receiveItems.map((item) => {
                      const currency = shopData?.currency || 'BYN';
                      const previewText = `${item.brandEmoji}${item.formatName}${item.formatStrengthLabel ? ' ' + item.formatStrengthLabel : ''}${item.brandEmoji}: (${item.formatUnitPrice || 0} ${currency})\n• ${item.name}`;
                      
                      return (
                        <motion.div
                          key={item.flavorId}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-success/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.brandEmoji} {item.formatName}
                              </p>
                              {receiveItems.length === 1 && (
                                <div className="mt-2">
                                  <label className="text-[10px] text-muted-foreground">Закупка (руб)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Опционально"
                                    value={item.customCostPrice ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setReceiveItems((prev) =>
                                        prev.map((i) => {
                                          if (i.flavorId !== item.flavorId) return i;
                                          if (v === '') return { ...i, customCostPrice: undefined };
                                          const n = parseFloat(v);
                                          if (!Number.isFinite(n)) return { ...i, customCostPrice: undefined };
                                          return { ...i, customCostPrice: Math.max(0, n) };
                                        })
                                      );
                                    }}
                                    className="mt-0.5 w-24 h-7 px-2 rounded text-xs bg-background border border-border"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReceiveItems(prev => prev.map(i => i.flavorId === item.flavorId ? { ...i, addQty: Math.max(1, i.addQty - 1) } : i))}>
                                <Minus size={12} />
                              </Button>
                              <span className="text-sm font-mono-nums w-4 text-center font-semibold text-success">{item.addQty}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReceiveItems(prev => prev.map(i => i.flavorId === item.flavorId ? { ...i, addQty: i.addQty + 1 } : i))}>
                                <Plus size={12} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setReceiveItems(prev => prev.filter(i => i.flavorId !== item.flavorId))}>
                                <X size={12} />
                              </Button>
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Предпросмотр поста:</p>
                            <pre className="text-xs whitespace-pre-wrap font-mono">{previewText}</pre>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="catalog" className="flex-1 overflow-hidden mt-0 p-0 flex flex-col">
              <div className="p-4 border-b">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewBarcode('');
                    setShowCreateForm(true);
                  }}
                  className="w-full"
                >
                  <Plus size={16} className="mr-2" />
                  Добавить новый товар
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CatalogView inventory={inventory} onSelect={addItemToReceive} />
              </div>
            </TabsContent>

            <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
              <Button className="w-full gradient-primary" onClick={confirmReceive} disabled={receiveItems.length === 0}>
                Принять ({receiveItems.reduce((s, i) => s + i.addQty, 0)} шт)
              </Button>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ScanModal 
        open={showScanCamera} 
        onOpenChange={(isOpen) => {
          setShowScanCamera(isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
        onScan={(code) => { 
          processBarcode(code);
        }} 
      />
    </>
  );
}

// --- Subcomponents ---

function CatalogView({ inventory, onSelect }: { inventory: any, onSelect: (id: string) => void }) {
  const [path, setPath] = useState<any[]>([]);

  const currentLevel = path.length;

  const handleBack = () => setPath(prev => prev.slice(0, -1));

  const categories = Array.isArray(inventory?.categories) ? inventory.categories : [];
  const brands = Array.isArray(inventory?.brands) ? inventory.brands : [];
  const productFormats = Array.isArray(inventory?.productFormats) ? inventory.productFormats : [];
  const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];

  const items = () => {
    if (currentLevel === 0) return categories;
    if (currentLevel === 1) return brands.filter((b: any) => b.categoryId === path[0]?.id);
    if (currentLevel === 2) return productFormats.filter((f: any) => f.brandId === path[1]?.id);
    if (currentLevel === 3) return flavors.filter((f: any) => f.productFormatId === path[2]?.id);
    return [];
  };

  const handleSelect = (item: any) => {
    if (currentLevel === 3) {
      onSelect(item.id);
      setPath(prev => prev.slice(0, -1));
    } else {
      setPath(prev => [...prev, item]);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {currentLevel > 0 && (
        <div className="flex items-center gap-2 p-2 border-b bg-background/50">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
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
        {items().map((item: any) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center justify-between p-3 border-b last:border-0 hover:bg-secondary/50 text-left transition-colors"
          >
            <div className="flex items-center gap-2">
              {item.emoji && <span>{item.emoji}</span>}
              {item.emojiPrefix && <span>{item.emojiPrefix}</span>}
              <span className="text-sm">{item.name}</span>
            </div>
            {currentLevel === 3 ? (
              <Plus size={16} className="text-primary" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground" />
            )}
          </button>
        ))}
        {items().length === 0 && <div className="text-center p-4 text-muted-foreground text-sm">Пусто</div>}
      </div>
    </div>
  );
}

function CreateItemForm({ barcode, onClose, onSuccess, inventory, onOpenCategoryManager }: { barcode: string, onClose: () => void, onSuccess: (id: string, details?: { brandName: string, formatName: string, flavorName: string, quantity: number }) => void, inventory: any, onOpenCategoryManager?: () => void }) {
  const { toast } = useToast();
  
  const categories = Array.isArray(inventory?.categories) ? inventory.categories : [];
  const brands = Array.isArray(inventory?.brands) ? inventory.brands : [];
  const productFormats = Array.isArray(inventory?.productFormats) ? inventory.productFormats : [];

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });
  
  const [formData, setFormData] = useState({
    barcode,
    categoryId: '',
    categoryName: '',
    brandId: '',
    brandName: '',
    brandEmoji: '',
    strengthLabel: '', // Для жидкостей и снюса - крепость (mg), для расходников - сопротивление (Ω)
    ohmValue: '', // Для расходников - омы (0.4, 1, 0.6 и т.д.)
    flavorName: '',
    costPrice: 0,
    unitPrice: 0,
    quantity: 1,
    customValues: {} as Record<string, any>
  });

  const [createNewCategory, setCreateNewCategory] = useState(false);
  const [isNewBrand, setIsNewBrand] = useState(true);
  const [showBarcodeScan, setShowBarcodeScan] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Проверка на похожие бренды
  const similarBrands = useMemo(() => {
    if (!formData.brandName || formData.brandName.length < 2) return [];
    if (!formData.categoryId) return [];
    
    return brands.filter((b: any) => {
      if (b.categoryId !== formData.categoryId) return false;
      return areSimilar(b.name, formData.brandName);
    });
  }, [formData.brandName, formData.categoryId, brands]);

  const selectedCategory = categories.find((c: any) => c.id === formData.categoryId);
  const isLiquidCategory = selectedCategory?.name?.toLowerCase().includes('жидкост') || 
                           selectedCategory?.name?.toLowerCase().includes('liquid');
  const isDeviceCategory = selectedCategory?.name?.toLowerCase().includes('устройств') || 
                           selectedCategory?.name?.toLowerCase().includes('device');
  const isSnusCategory = selectedCategory?.name?.toLowerCase().includes('снюс') || 
                         selectedCategory?.name?.toLowerCase().includes('snus');
  const isConsumableCategory = selectedCategory?.name?.toLowerCase().includes('расходник') || 
                                selectedCategory?.name?.toLowerCase().includes('consumable');
  const isDisposableCategory = selectedCategory?.name?.toLowerCase().includes('одноразк') || 
                                selectedCategory?.name?.toLowerCase().includes('disposable');

  const createMutation = useMutation({
    mutationFn: (data: any) => api<{ success: boolean, flavorId: string }>('/api/inventory/product', { method: 'POST', body: data }),
    onSuccess: (data) => {
      // Формируем детали товара для сообщения из formData
      let brandName = '';
      let formatName = '';
      let flavorName = formData.flavorName || '';
      
      if (isNewBrand) {
        brandName = formData.brandName || '';
        // Формируем formatName так же, как в payload
        if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
          formatName = formData.strengthLabel ? `${formData.brandName} ${formData.strengthLabel}`.trim() : formData.brandName || '';
        } else {
          if (isConsumableCategory && formData.ohmValue) {
            formatName = `${formData.brandName} ${formData.ohmValue}`;
          } else {
            formatName = formData.brandName || '';
          }
        }
      } else {
        const selectedBrand = brands.find((b: any) => b.id === formData.brandId);
        brandName = selectedBrand?.name || '';
        
        if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
          let computedFormatName = selectedBrand?.name || '';
          if (formData.strengthLabel) {
            computedFormatName = `${selectedBrand?.name || ''} ${formData.strengthLabel}`.trim();
          }
          const selectedFormat = productFormats.find((f: any) => 
            f.brandId === formData.brandId && f.name === computedFormatName
          );
          formatName = selectedFormat?.name || computedFormatName;
        } else {
          if (isConsumableCategory && formData.ohmValue) {
            const computedFormatName = `${selectedBrand?.name || ''} ${formData.ohmValue}`;
            const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && f.name === computedFormatName
            );
            formatName = selectedFormat?.name || computedFormatName;
          } else {
            const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && f.name === selectedBrand?.name
            );
            formatName = selectedFormat?.name || selectedBrand?.name || '';
          }
        }
      }
      
      onSuccess(data.flavorId, {
        brandName,
        formatName,
        flavorName,
        quantity: formData.quantity,
      });
    },
    onError: (error: any) => {
      console.error('Create error:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let legacyConsumableOhmNormalized: string | undefined;
    let legacyConsumableResistanceNormalized: string | undefined;
    
    if (isNewBrand && similarBrands.length > 0) {
      return; // Не отправляем если есть похожие бренды
    }
    
    // Валидация обязательных полей
    const unitPriceValue = typeof formData.unitPrice === 'string' 
      ? (formData.unitPrice === '' ? 0 : parseFloat(formData.unitPrice) || 0)
      : formData.unitPrice;
    
    if (unitPriceValue <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Цена продажи должна быть больше нуля',
        variant: 'destructive',
      });
      return;
    }

    const costPriceValue =
      typeof formData.costPrice === 'string'
        ? formData.costPrice === ''
          ? 0
          : parseFloat(formData.costPrice) || 0
        : formData.costPrice;
    if (costPriceValue < 0) {
      toast({
        title: 'Ошибка',
        description: 'Себестоимость (закупка) не может быть отрицательной',
        variant: 'destructive',
      });
      return;
    }

    // Validation Logic
    if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
        // Dynamic Validation
        const missingFields = selectedCategory.customFields.filter((f: any) => 
            f.required && (
                f.target === 'flavor_name' ? !formData.flavorName :
                f.target === 'strength_label' ? !formData.strengthLabel :
                !formData.customValues?.[f.name]
            )
        );
        
        if (missingFields.length > 0) {
             toast({
                title: 'Ошибка',
                description: `Заполните обязательные поля: ${missingFields.map((f: any) => f.label).join(', ')}`,
                variant: 'destructive',
            });
            return;
        }
    } else {
        // Legacy Validation
        if (isConsumableCategory) {
          if (!formData.ohmValue?.trim()) {
            toast({
              title: 'Ошибка',
              description: 'Введите значение омов (например: 0.4, 1, 0.6)',
              variant: 'destructive',
            });
            return;
          }
          const ohmParsed = normalizeDecimalNumericInput(formData.ohmValue);
          if (!ohmParsed.ok) {
            toast({
              title: 'Ошибка',
              description: 'Номинал омов — только число, например 0.8 или 0,8 (запятая тоже подойдёт).',
              variant: 'destructive',
            });
            return;
          }
          legacyConsumableOhmNormalized = ohmParsed.normalized;

          if (formData.strengthLabel?.trim()) {
            const qtyParsed = normalizeDecimalNumericInput(formData.strengthLabel);
            if (!qtyParsed.ok) {
              toast({
                title: 'Ошибка',
                description: 'Во втором поле — только число, например 1 или 0,8.',
                variant: 'destructive',
              });
              return;
            }
            legacyConsumableResistanceNormalized = qtyParsed.normalized;
          }
        } else if (isDeviceCategory || isDisposableCategory) {
          // Для устройств и одноразок: нужен цвет/вкус
          if (!formData.flavorName?.trim()) {
            toast({
              title: 'Ошибка',
              description: isDisposableCategory ? 'Введите вкус' : 'Введите цвет устройства',
              variant: 'destructive',
            });
            return;
          }
        } else {
          // Для жидкостей и снюса: нужен вкус
          if (!formData.flavorName?.trim()) {
            toast({
              title: 'Ошибка',
              description: 'Введите название вкуса',
              variant: 'destructive',
            });
            return;
          }
        }
        
        // Для жидкостей при новом бренде нужна крепость
        if (isLiquidCategory && isNewBrand && !formData.strengthLabel?.trim()) {
          toast({
            title: 'Ошибка',
            description: 'Введите крепость (мг)',
            variant: 'destructive',
          });
          return;
        }
        
        // Для снюса крепость нужна всегда
        if (isSnusCategory && !formData.strengthLabel?.trim()) {
          toast({
            title: 'Ошибка',
            description: 'Введите крепость (мг)',
            variant: 'destructive',
          });
          return;
        }
    }
    
    if (!formData.brandName && !formData.brandId) {
      toast({
        title: 'Ошибка',
        description: 'Выберите или введите название бренда',
        variant: 'destructive',
      });
      return;
    }
    
    // Собираем все customValues, включая значения из полей с target
    let allCustomValues: Record<string, any> = { ...formData.customValues };
    
    if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
      // Добавляем значения из полей с target в customValues
      selectedCategory.customFields.forEach((field: any) => {
        if (field.target === 'strength_label' && formData.strengthLabel) {
          allCustomValues[field.name] = formData.strengthLabel;
        } else if (field.target === 'flavor_name' && formData.flavorName) {
          allCustomValues[field.name] = formData.flavorName;
        }
      });
    }
    
    const payload: any = {
      barcode: formData.barcode.trim() || null,
      costPrice: Math.max(0, costPriceValue),
      unitPrice: unitPriceValue,
      quantity: formData.quantity,
      customValues: Object.keys(allCustomValues).length > 0 ? allCustomValues : undefined,
    };

    if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
        // Dynamic Mode Payload
        payload.flavorName = formData.flavorName;
        payload.strengthLabel = formData.strengthLabel;
    } else {
        // Legacy Mode Payload
        payload.flavorName = (isDeviceCategory || isDisposableCategory)
            ? formData.flavorName
            : isConsumableCategory 
            ? '' 
            : formData.flavorName;
        
        payload.ohmValue = isConsumableCategory ? legacyConsumableOhmNormalized ?? formData.ohmValue.trim() : undefined;
        payload.resistanceValue =
          isConsumableCategory && legacyConsumableResistanceNormalized !== undefined
            ? legacyConsumableResistanceNormalized
            : undefined;
        payload.strengthLabel = formData.strengthLabel;
    }

    if (createNewCategory) {
      payload.categoryName = formData.categoryName;
    } else {
      payload.categoryId = formData.categoryId;
    }

    if (isNewBrand) {
      // Создаем новый бренд
      payload.brandName = formData.brandName;
      if (formData.brandEmoji) {
        payload.brandEmoji = formData.brandEmoji;
      }
      
      if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
          // Dynamic Format Name
          if (formData.strengthLabel) {
              payload.formatName = `${formData.brandName} ${formData.strengthLabel}`.trim();
          } else {
              payload.formatName = formData.brandName;
          }
      } else {
          // Legacy Format Name
          if (isConsumableCategory && payload.ohmValue) {
            payload.formatName = `${formData.brandName} ${payload.ohmValue}`;
          } else {
            payload.formatName = formData.brandName;
          }
      }
    } else {
      // Используем существующий бренд
      payload.brandId = formData.brandId;
      const selectedBrand = brands.find((b: any) => b.id === formData.brandId);
      
      if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
          // Dynamic Format Selection
           let formatName = selectedBrand?.name || '';
           if (formData.strengthLabel) {
               formatName = `${selectedBrand?.name || ''} ${formData.strengthLabel}`.trim();
           }
           
           const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && f.name === formatName
            );
            
            if (selectedFormat) {
              payload.formatId = selectedFormat.id;
            } else {
              payload.formatName = formatName;
            }

      } else {
          // Legacy Format Selection
          if (isConsumableCategory && payload.ohmValue) {
            const formatName = `${selectedBrand?.name || ''} ${payload.ohmValue}`;
            const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && f.name === formatName
            );
            if (selectedFormat) {
              payload.formatId = selectedFormat.id;
            } else {
              payload.formatName = formatName;
            }
          } else if (selectedBrand) {
            const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && f.name === selectedBrand.name
            );
            if (selectedFormat) {
              payload.formatId = selectedFormat.id;
            } else {
              payload.formatName = selectedBrand.name;
            }
          }
      }
    }
    
    // Нормализация крепости
    if ((isLiquidCategory || isSnusCategory || isDisposableCategory || (selectedCategory?.customFields && selectedCategory.customFields.length > 0)) && payload.strengthLabel) {
      let normalizedStrength = payload.strengthLabel.trim();
      // Only append mg if it matches digits only and we are in legacy liquid/snus mode OR if the field is named "strength" (heuristic)
      // For now, let's be conservative and only do it for legacy categories to avoid messing up "Ohms" if they use strengthLabel for it.
      // But wait, "Ohms" usually has a dot (0.6), so \d+ won't match.
      // So \d+ matching is safe-ish for mg.
      if (normalizedStrength && !normalizedStrength.toLowerCase().includes('mg') && !normalizedStrength.toLowerCase().includes('мг') && !normalizedStrength.includes('Ω')) {
        const numMatch = normalizedStrength.match(/^\d+$/);
        if (numMatch && (isLiquidCategory || isSnusCategory || isDisposableCategory)) {
          normalizedStrength = `${numMatch[0]} mg`;
        }
      }
      payload.strengthLabel = normalizedStrength;
    }
    
    createMutation.mutate(payload);
  };

  return (
    <>
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0 flex flex-col">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Новый товар</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-0 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label>Штрихкод (необязательно)</Label>
            <div className="flex gap-2">
              <Input
                ref={barcodeInputRef}
                className="flex-1"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Оставьте пустым, если нет штрихкода"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowBarcodeScan(true)}
                aria-label="Сканировать штрихкод"
              >
                <ScanLine size={18} />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Категория</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  if (!createNewCategory && onOpenCategoryManager) {
                    // Открываем окно управления категориями
                    onOpenCategoryManager();
                  } else {
                    // Переключаем режим создания новой категории
                    setCreateNewCategory(!createNewCategory);
                    if (!createNewCategory) {
                      setFormData({...formData, categoryId: '', categoryName: ''});
                    }
                  }
                }}
              >
                {createNewCategory ? 'Выбрать существующую' : 'Создать новую'}
              </Button>
            </div>
            {createNewCategory ? (
              <Input
                value={formData.categoryName}
                onChange={e => setFormData({...formData, categoryName: e.target.value})}
                placeholder="Название категории..."
                required
              />
            ) : (
              <Select
                value={formData.categoryId || undefined}
                onValueChange={(categoryId) => {
                  setFormData({
                    ...formData,
                    categoryId,
                    brandId: '',
                    brandName: '',
                    brandEmoji: '',
                    strengthLabel: '',
                    ohmValue: '',
                    flavorName: '',
                    customValues: {},
                  });
                  setIsNewBrand(true);
                }}
              >
                <SelectTrigger className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {formData.categoryId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Бренд (линейка)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    setIsNewBrand(!isNewBrand);
                    if (!isNewBrand) {
                      setFormData({...formData, brandId: '', brandName: '', brandEmoji: ''});
                    } else {
                      setFormData({...formData, brandName: '', brandEmoji: ''});
                    }
                  }}
                >
                  {isNewBrand ? 'Выбрать существующий' : 'Создать новый'}
                </Button>
              </div>
              {isNewBrand ? (
                <>
                  <Input
                    value={formData.brandName}
                    onChange={e => setFormData({...formData, brandName: e.target.value, brandId: ''})}
                    placeholder="Название бренда..."
                    required
                  />
                  {similarBrands.length > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg text-xs">
                      <AlertCircle size={14} className="text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-warning mb-1">Похожий бренд уже существует:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {similarBrands.map((b: any) => (
                            <li key={b.id}>{b.emojiPrefix} {b.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Select
                  value={formData.brandId || undefined}
                  onValueChange={(brandId) => {
                    const selectedFormat = productFormats.find((f: any) => f.brandId === brandId);
                    setFormData({
                      ...formData,
                      brandId,
                      brandName: '',
                      brandEmoji: '',
                      ohmValue: '',
                      unitPrice: selectedFormat ? selectedFormat.unitPrice : formData.unitPrice,
                      customValues: {},
                    });
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm">
                    <SelectValue placeholder="Выберите бренд" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {brands
                      .filter((b: any) => b.categoryId === formData.categoryId)
                      .map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.emojiPrefix} {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {formData.brandName && (
            <div className="space-y-2">
              <Label>Эмодзи префикс (необязательно)</Label>
              <Input
                value={formData.brandEmoji}
                onChange={e => setFormData({...formData, brandEmoji: e.target.value})}
                placeholder="Вставьте эмодзи или символы"
              />
            </div>
          )}

          {/* Dynamic Fields Rendering */}
          {selectedCategory?.customFields && selectedCategory.customFields.length > 0 ? (
            <div className="space-y-4">
              {selectedCategory.customFields
                .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map((field: any) => (
                <div key={field.id} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === 'select' ? (
                    <Select
                      value={
                        (field.target === 'flavor_name'
                          ? formData.flavorName
                          : field.target === 'strength_label'
                            ? formData.strengthLabel
                            : formData.customValues?.[field.name]) || undefined
                      }
                      onValueChange={(val) => {
                        if (field.target === 'flavor_name') {
                          setFormData({ ...formData, flavorName: val });
                        } else if (field.target === 'strength_label') {
                          setFormData({ ...formData, strengthLabel: val });
                        } else {
                          setFormData({
                            ...formData,
                            customValues: {
                              ...formData.customValues,
                              [field.name]: val,
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm">
                        <SelectValue placeholder="Выберите..." />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {field.options?.map((opt: string) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={
                        field.target === 'flavor_name' ? formData.flavorName :
                        field.target === 'strength_label' ? formData.strengthLabel :
                        formData.customValues?.[field.name] || ''
                      }
                      onChange={e => {
                        const val = e.target.value;
                        if (field.target === 'flavor_name') {
                          setFormData({...formData, flavorName: val});
                        } else if (field.target === 'strength_label') {
                          setFormData({...formData, strengthLabel: val});
                        } else {
                          setFormData({
                            ...formData,
                            customValues: {
                              ...formData.customValues,
                              [field.name]: val
                            }
                          });
                        }
                      }}
                      placeholder={field.label}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Legacy Fields Fallback */}
              {/* Крепость для жидкостей (только при создании нового бренда) */}
              {isLiquidCategory && isNewBrand && (formData.brandName || formData.brandId) && (
                <div className="space-y-2">
                  <Label>Крепость (мг)</Label>
                  <Input
                    value={formData.strengthLabel}
                    onChange={e => setFormData({...formData, strengthLabel: e.target.value})}
                    placeholder="50"
                    required={isNewBrand}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Введите число, "mg" добавится автоматически
                  </p>
                </div>
              )}

              {/* Крепость для снюса (всегда) */}
              {isSnusCategory && (formData.brandName || formData.brandId) && (
                <div className="space-y-2">
                  <Label>Крепость (мг)</Label>
                  <Input
                    value={formData.strengthLabel}
                    onChange={e => setFormData({...formData, strengthLabel: e.target.value})}
                    placeholder="50"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Введите число, "mg" добавится автоматически
                  </p>
                </div>
              )}

              {/* Омы для расходников - показываем всегда когда выбран бренд */}
              {isConsumableCategory && (formData.brandName || formData.brandId) && (
                <div className="space-y-2">
                  <Label>Омы (номинал)</Label>
                  <Input
                    value={formData.ohmValue}
                    onChange={e => setFormData({...formData, ohmValue: e.target.value})}
                    placeholder="Например 0.8 или 0,8"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Указано на койле или упаковке
                  </p>
                </div>
              )}

              {/* Доп. подпись для расходников (необязательно) — уходит в название позиции */}
              {isConsumableCategory && formData.ohmValue && (
                <div className="space-y-2">
                  <Label>Дополнение к названию (необязательно)</Label>
                  <Input
                    value={formData.strengthLabel}
                    onChange={e => setFormData({...formData, strengthLabel: e.target.value})}
                    placeholder="Например 5 — если нужно количество в упаковке"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Только число. Будет показано рядом с омами в списке товаров, если заполнить
                  </p>
                </div>
              )}

              {/* Вкус для жидкостей и снюса */}
              {(isLiquidCategory || isSnusCategory) && (
                <div className="space-y-2">
                  <Label>Вкус</Label>
                  <Input 
                    value={formData.flavorName} 
                    onChange={e => setFormData({...formData, flavorName: e.target.value})} 
                    placeholder="Например: Клубника"
                    required
                  />
                </div>
              )}

              {/* Цвет для устройств */}
              {isDeviceCategory && (
                <div className="space-y-2">
                  <Label>Цвет</Label>
                  <Input 
                    value={formData.flavorName} 
                    onChange={e => setFormData({...formData, flavorName: e.target.value})} 
                    placeholder="Например: Чёрный"
                    required
                  />
                </div>
              )}

              {/* Вкус для одноразок */}
              {isDisposableCategory && (
                <div className="space-y-2">
                  <Label>Вкус</Label>
                  <Input 
                    value={formData.flavorName} 
                    onChange={e => setFormData({...formData, flavorName: e.target.value})} 
                    placeholder="Например: Клубника"
                    required
                  />
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Себестоимость</Label>
              <Input 
                type="number" 
                step="0.01"
                min={0}
                value={formData.costPrice || ''} 
                onChange={e => {
                  const val = e.target.value;
                  if (val === '') {
                    setFormData({ ...formData, costPrice: 0 });
                    return;
                  }
                  const n = parseFloat(val);
                  setFormData({
                    ...formData,
                    costPrice: Number.isFinite(n) ? Math.max(0, n) : 0,
                  });
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Цена продажи</Label>
              <Input 
                type="number" 
                step="0.01"
                value={formData.unitPrice || ''} 
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, unitPrice: val === '' ? 0 : parseFloat(val) || 0});
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Preview */}
          {(() => {
            const currency = shopData?.currency || 'BYN';
            let brandName = '';
            let brandEmoji = '';
            let unitPrice = 0;
            
            if (isNewBrand) {
              brandEmoji = formData.brandEmoji || '';
              brandName = formData.brandName || '';
              unitPrice = typeof formData.unitPrice === 'string' 
                ? (formData.unitPrice === '' ? 0 : parseFloat(formData.unitPrice) || 0)
                : formData.unitPrice || 0;
            } else {
              if (formData.brandId) {
                const selectedBrand = brands.find((b: any) => b.id === formData.brandId);
                if (selectedBrand) {
                  brandEmoji = selectedBrand.emojiPrefix || '';
                  brandName = selectedBrand.name || '';
                }
              }
              unitPrice = typeof formData.unitPrice === 'string' 
                ? (formData.unitPrice === '' ? 0 : parseFloat(formData.unitPrice) || 0)
                : formData.unitPrice || 0;
            }

            let displayFormatName = brandName || 'Название бренда';
            let flavorDisplay = '';

            if (selectedCategory?.customFields && selectedCategory.customFields.length > 0) {
                // Dynamic Preview с учетом customFields
                const strengthFields = selectedCategory.customFields.filter((f: any) => f.target === 'strength_label');
                const flavorFields = selectedCategory.customFields.filter((f: any) => f.target === 'flavor_name');
                
                // Формируем название формата из всех полей с target='strength_label'
                const strengthParts: string[] = [];
                if (formData.strengthLabel && formData.strengthLabel.trim()) {
                  strengthParts.push(formData.strengthLabel.trim());
                }
                // Добавляем customValues для полей strength_label
                if (formData.customValues && typeof formData.customValues === 'object') {
                  strengthFields.forEach((field: any) => {
                    if (field.name in formData.customValues && formData.customValues[field.name]) {
                      const value = String(formData.customValues[field.name]).trim();
                      if (value) strengthParts.push(value);
                    }
                  });
                }
                
                if (strengthParts.length > 0) {
                  displayFormatName = `${brandName} ${strengthParts.join(' ')}`.trim();
                }

                // Формируем отображение вкуса/цвета из всех полей с target='flavor_name'
                const flavorParts: string[] = [];
                if (formData.flavorName && formData.flavorName.trim()) {
                  flavorParts.push(formData.flavorName.trim());
                }
                // Добавляем customValues для полей flavor_name
                if (formData.customValues && typeof formData.customValues === 'object') {
                  flavorFields.forEach((field: any) => {
                    if (field.name in formData.customValues && formData.customValues[field.name]) {
                      const value = String(formData.customValues[field.name]).trim();
                      if (value) flavorParts.push(value);
                    }
                  });
                }
                
                flavorDisplay = flavorParts.length > 0 
                  ? flavorParts.join(' ') 
                  : (flavorFields.length > 0 ? flavorFields[0].label : 'Вкус/Цвет');
                
                // Добавляем custom поля в предпросмотр
                const customFieldsList = selectedCategory.customFields.filter((f: any) => f.target === 'custom');
                if (customFieldsList.length > 0 && formData.customValues) {
                  const customParts: string[] = [];
                  customFieldsList.forEach((field: any) => {
                    if (field.name in formData.customValues && formData.customValues[field.name]) {
                      const value = String(formData.customValues[field.name]).trim();
                      if (value) {
                        customParts.push(`${field.label}: ${value}`);
                      }
                    }
                  });
                  if (customParts.length > 0) {
                    flavorDisplay += ` (${customParts.join(', ')})`;
                  }
                }
            } else {
                // Legacy Preview Logic
                let strengthLabel = formData.strengthLabel || '';
                let flavorName = formData.flavorName || '';
                 
                if ((isLiquidCategory || isSnusCategory || isDisposableCategory) && strengthLabel && !strengthLabel.toLowerCase().includes('mg') && !strengthLabel.toLowerCase().includes('мг')) {
                  const numMatch = strengthLabel.match(/\d+/);
                  if (numMatch) {
                    strengthLabel = `${numMatch[0]} mg`;
                  }
                }

                if (isConsumableCategory && formData.ohmValue) {
                  displayFormatName = `${brandName || 'Название бренда'} ${formData.ohmValue}`.trim();
                } else if (strengthLabel) {
                  displayFormatName = `${brandName || 'Название бренда'} ${strengthLabel}`.trim();
                }
                
                let fieldLabel = 'Вкус';
                if (isDeviceCategory) fieldLabel = 'Цвет';
                else if (isConsumableCategory) fieldLabel = 'Модель';
                else if (isSnusCategory || isLiquidCategory || isDisposableCategory) fieldLabel = 'Вкус';
                
                flavorDisplay = flavorName || fieldLabel;
            }

            const previewText = `${brandEmoji || ''}${displayFormatName}${brandEmoji || ''}: (${unitPrice || 0} ${currency})\n• ${flavorDisplay}`;

            return (
              <div className="p-3 rounded-lg bg-secondary/80 border border-border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Предпросмотр поста:</p>
                <pre className="text-xs whitespace-pre-wrap font-mono">{previewText}</pre>
              </div>
            );
          })()}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button 
              type="submit" 
              disabled={
                createMutation.isPending || 
                (isNewBrand && similarBrands.length > 0) ||
                (!formData.brandName && !formData.brandId) ||
                (selectedCategory?.customFields && selectedCategory.customFields.length > 0
                  ? selectedCategory.customFields.some((f: any) => 
                      f.required && (
                        f.target === 'flavor_name' ? !formData.flavorName :
                        f.target === 'strength_label' ? !formData.strengthLabel :
                        !formData.customValues?.[f.name]
                      )
                    )
                  : (
                    (isConsumableCategory && !formData.ohmValue) ||
                    ((isDeviceCategory || isDisposableCategory) && !formData.flavorName) ||
                    (isLiquidCategory && (!formData.flavorName || (isNewBrand && !formData.strengthLabel))) ||
                    (isSnusCategory && (!formData.flavorName || !formData.strengthLabel))
                  )
                )
              }
            >
              {createMutation.isPending ? 'Создание...' : 'Создать и добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ScanModal
      open={showBarcodeScan}
      onOpenChange={(isOpen) => {
        setShowBarcodeScan(isOpen);
        if (!isOpen) {
          setTimeout(() => barcodeInputRef.current?.focus(), 100);
        }
      }}
      onScan={(code) => {
        setFormData((prev) => ({ ...prev, barcode: code }));
        setShowBarcodeScan(false);
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      }}
    />
    </>
  );
}

