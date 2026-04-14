'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Minus, ScanLine, PackagePlus, ChevronRight, ChevronDown, ArrowLeft, Check, X, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiException } from '@/lib/api-client';
import { getCurrencySymbol } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { ScanModal } from './ScanModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { filterStrengthNumericInput } from '@/lib/inventory-input-filters';
import {
  filterNonNegativeDecimalInput,
  filterDigitsOnly,
  parseNonNegativeDecimal,
  parsePositiveInt,
} from '@/lib/numeric-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CameraPermissionUiState } from '@/lib/camera-permission';
import { watchCameraPermission } from '@/lib/camera-permission';

interface ReceiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCategoryManager?: () => void;
  initialBarcode?: string | null;
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

/** Крупный блок «только что» + до двух предыдущих строк в сессии сканирования. */
type ScanSessionHighlight = {
  id: string;
  flavorId: string;
  lineTitle: string;
  lineSub: string;
  deltaThisScan: number;
  sessionQty: number;
};

type ScanSessionUi = { current: ScanSessionHighlight | null; prior: ScanSessionHighlight[] };

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

type DecimalParseOpts = { min?: number; max?: number };

function normalizeBarcode(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeEntityName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Омы и доп. поля: скобки, запятая, «.8», Ω, пробелы, странные символы с клавиатур — нормализуем. */
function normalizeDecimalNumericInput(
  raw: string,
  opts?: DecimalParseOpts,
): { ok: true; normalized: string } | { ok: false; reason: 'empty' | 'format' | 'range' } {
  let s = raw.normalize('NFKC').trim();
  if (!s) return { ok: false, reason: 'empty' };
  while (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).normalize('NFKC').trim();
  }
  s = s.replace(/\s/g, '');
  s = s.replace(/[ΩΩ]|ohm|ом/gi, '');

  const commaCount = (s.match(/,/g) || []).length;
  const hasDot = s.includes('.');
  if (commaCount === 1 && !hasDot) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  if (s.startsWith('.')) s = `0${s}`;
  if (s.endsWith('.')) s = s.slice(0, -1);

  let token = s;
  if (!/^\d+(\.\d+)?$/.test(token)) {
    const m = s.match(/\d+(?:\.\d+)?/);
    if (!m) return { ok: false, reason: 'format' };
    token = m[0];
  }

  const n = Number(token);
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'format' };

  if (opts?.min !== undefined && n + 1e-9 < opts.min) return { ok: false, reason: 'range' };
  if (opts?.max !== undefined && n - 1e-9 > opts.max) return { ok: false, reason: 'range' };

  return { ok: true, normalized: token };
}

export function ReceiveModal({ open, onOpenChange, onOpenCategoryManager, initialBarcode }: ReceiveModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('scan');
  const [scanInput, setScanInput] = useState('');
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [showScanCamera, setShowScanCamera] = useState(false);
  const [scanSession, setScanSession] = useState<ScanSessionUi>({ current: null, prior: [] });
  const [receiveDetailsOpen, setReceiveDetailsOpen] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionUiState>('unknown');
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  
  // New Item Creation State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBarcodeRef = useRef<string | null>(null);

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<any>('/api/inventory'),
    enabled: open,
  });

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
  });

  type ReceiveBatchLine = {
    flavorId: string;
    quantity: number;
    costPrice?: number;
    comment?: string;
  };

  const receiveBatch = useMutation({
    mutationFn: (items: ReceiveBatchLine[]) =>
      api<{ items: unknown[] }>('/api/inventory/stock/batch', { method: 'POST', body: { items } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка приёмки',
        description: err.message || 'Не удалось провести приёмку',
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

  useEffect(() => {
    if (!open || !initialBarcode) return;
    setActiveTab('scan');
    processBarcode(initialBarcode, { silent: true });
  }, [open, initialBarcode]);

  useEffect(() => {
    if (!open) {
      setScanSession({ current: null, prior: [] });
    }
  }, [open]);

  /** Без getUserMedia: только Permissions API (Chromium), чтобы не дублировать запрос вместе со сканером. */
  useEffect(() => {
    if (!open || activeTab !== 'scan') return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void watchCameraPermission((s) => {
      if (!cancelled) setCameraPermission(s);
    }).then((u) => {
      if (!cancelled) unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
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

  const processBarcode = (code: string, opts?: { silent?: boolean }) => {
    const normalizedCode = normalizeBarcode(code);
    if (!normalizedCode) return;

    const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];
    if (!flavors.length) {
      pendingBarcodeRef.current = normalizedCode;
      setScanInput('');
      return;
    }

    const foundByBarcode = flavors.find((f: any) => normalizeBarcode(String(f.barcode || '')) === normalizedCode);
    
    if (foundByBarcode) {
      addItemToReceive(foundByBarcode.id);
      setScanInput('');
      setNotFoundBarcode(null);
      pendingBarcodeRef.current = null;
      if (!opts?.silent) {
        toast({
          title: 'Товар принят',
          description: `${foundByBarcode.name} (+1)`,
          duration: 2000,
        });
      }
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    setNotFoundBarcode(normalizedCode);
    setScanInput('');
    toast({
      title: 'Товар не найден',
      description: `Штрихкод: ${normalizedCode}`,
      variant: 'destructive',
      duration: 3000,
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
    const lineTitle = [brand?.emojiPrefix, brand?.name, format?.name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const lineSub = (flavor.name || '').trim();

    setReceiveItems((prev) => {
      const existing = prev.find((i) => i.flavorId === flavorId);
      const next =
        existing != null
          ? prev.map((i) => (i.flavorId === flavorId ? { ...i, addQty: i.addQty + 1 } : i))
          : [
              ...prev,
              {
                flavorId,
                name: flavor.name,
                formatName: format?.name || '',
                brandEmoji: brand?.emojiPrefix || '',
                currentQty: flavor.quantity,
                addQty: 1,
                formatStrengthLabel: format?.strengthLabel || '',
                formatUnitPrice: format?.unitPrice || 0,
              },
            ];
      const row = next.find((i) => i.flavorId === flavorId);
      const sessionQty = row?.addQty ?? 1;
      const highlight: ScanSessionHighlight = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        flavorId,
        lineTitle: lineTitle || lineSub || 'Товар',
        lineSub: lineTitle ? lineSub : '',
        deltaThisScan: 1,
        sessionQty,
      };
      queueMicrotask(() => {
        setScanSession((s) => ({
          current: highlight,
          prior: s.current ? [s.current, ...s.prior].slice(0, 2) : s.prior,
        }));
      });
      return next;
    });
  };

  useEffect(() => {
    if (!open) {
      pendingBarcodeRef.current = null;
      return;
    }
    const pendingBarcode = pendingBarcodeRef.current;
    const flavors = Array.isArray(inventory?.flavors) ? inventory.flavors : [];
    if (!pendingBarcode || !flavors.length) return;
    pendingBarcodeRef.current = null;
    processBarcode(pendingBarcode);
  }, [open, inventory?.flavors]);

  const confirmReceive = async () => {
    if (isReceiving || receiveBatch.isPending) return;
    try {
      setIsReceiving(true);
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
      
      const batchLines: ReceiveBatchLine[] = receiveItems.map((ri) => {
        const line: ReceiveBatchLine = {
          flavorId: ri.flavorId,
          quantity: ri.currentQty + ri.addQty,
          comment: `Приёмка: +${ri.addQty} шт`,
        };
        if (ri.customCostPrice != null && ri.customCostPrice > 0) {
          line.costPrice = ri.customCostPrice;
        }
        return line;
      });

      await receiveBatch.mutateAsync(batchLines);

      for (const ri of receiveItems) {
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
      setScanSession({ current: null, prior: [] });
      setNotFoundBarcode(null);
      // Окно приёма остаётся открытым для серии приёмок (ТЗ R-01)

      toast({
        title: 'Товары приняты на склад',
        description: `Принято ${totalQty} единиц. ${itemsDetails.join('. ')}`,
        duration: 2000,
      });
    } catch (e) {
      toast({ title: "Ошибка", variant: "destructive" });
    } finally {
      setIsReceiving(false);
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

            <TabsContent value="scan" className="flex-1 flex min-h-0 flex-col overflow-hidden mt-0 p-0">
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2 pt-3">
                  <form onSubmit={handleScanSubmit} className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={inputRef}
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="USB-сканер или ввод…"
                        className="pl-9 rounded-[12px]"
                        autoComplete="off"
                      />
                    </div>
                  </form>

                  {cameraPermission === 'denied' && (
                    <p className="rounded-lg border border-destructive/25 bg-destructive/10 p-2.5 text-xs leading-snug text-destructive">
                      Камера для этого сайта отключена. В Chrome / Edge: значок замка слева от адреса → разрешения сайта → Камера → «Разрешить». В Safari: «АА» → Настройки для сайта → Камера. Затем снова нажмите «Сканировать».
                    </p>
                  )}
                  {cameraPermission === 'granted' && (
                    <p className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs leading-snug text-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2} />
                      <span>
                        Камера для этого сайта уже разрешена — откроется сразу, без повторного системного запроса.
                      </span>
                    </p>
                  )}
                  {cameraPermission === 'unknown' && (
                    <p className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs leading-snug text-muted-foreground">
                      Запрос к камере только при нажатии «Сканировать». Откройте приложение по <strong className="text-foreground">HTTPS</strong> с постоянным доменом — тогда браузер запомнит выбор и не будет спрашивать при каждом визите.
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewBarcode('');
                      setShowCreateForm(true);
                    }}
                    className="w-full rounded-[12px]"
                  >
                    <Plus size={16} className="mr-2" />
                    Добавить новый товар
                  </Button>

                  {notFoundBarcode && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-destructive/20 bg-destructive/10 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                        <div className="flex-1">
                          <p className="mb-1 text-sm font-medium text-destructive">Товар не найден</p>
                          <p className="mb-3 text-xs text-muted-foreground">Штрихкод: {notFoundBarcode}</p>
                          <Button size="sm" variant="outline" onClick={handleCreateFromNotFound} className="w-full">
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
                      className="overflow-hidden rounded-xl border bg-background"
                    >
                      {searchResults.map((f: any) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            addItemToReceive(f.id);
                            setScanInput('');
                          }}
                          className="flex w-full items-center justify-between border-b p-2 text-left last:border-0 hover:bg-secondary"
                        >
                          <span className="text-sm">{f.name}</span>
                          <Plus size={14} />
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {scanSession.current ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-[20px] border border-primary/35 bg-primary/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-primary/90">Сейчас</p>
                          <p className="mt-1 text-lg font-semibold leading-snug text-foreground">
                            {scanSession.current.lineTitle}
                          </p>
                          {scanSession.current.lineSub ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">{scanSession.current.lineSub}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            В этой приёмке:{' '}
                            <span className="font-semibold text-foreground">
                              {receiveItems.find((r) => r.flavorId === scanSession.current!.flavorId)?.addQty ??
                                scanSession.current.sessionQty}{' '}
                              шт
                            </span>
                          </p>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-primary/20 px-3 py-2 text-center">
                          <p className="text-2xl font-bold leading-none text-primary">+{scanSession.current.deltaThisScan}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">за скан</p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                      Нажмите «Сканировать» внизу или введите код / USB-сканером
                    </div>
                  )}

                  {scanSession.prior.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ранее в этой сессии</p>
                      <div className="space-y-2">
                        {scanSession.prior.map((h) => {
                          const row = receiveItems.find((r) => r.flavorId === h.flavorId);
                          const qty = row?.addQty;
                          return (
                            <div
                              key={h.id}
                              className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{h.lineTitle}</p>
                                {h.lineSub ? (
                                  <p className="truncate text-xs text-muted-foreground">{h.lineSub}</p>
                                ) : null}
                              </div>
                              {qty != null ? (
                                <span className="shrink-0 rounded-lg bg-background/80 px-2 py-0.5 text-xs font-semibold tabular-nums">
                                  {qty} шт
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Collapsible open={receiveDetailsOpen} onOpenChange={setReceiveDetailsOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm font-medium"
                      >
                        <span>
                          Все позиции в приёмке
                          {receiveItems.length > 0 ? (
                            <span className="ml-2 text-muted-foreground">({receiveItems.length})</span>
                          ) : null}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${receiveDetailsOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {receiveItems.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">Пока пусто</p>
                      ) : (
                        receiveItems.map((item) => {
                          const lineLabel = `${item.brandEmoji} ${item.formatName} ${item.name}`.replace(/\s+/g, ' ').trim();
                          const curSym = getCurrencySymbol(shopData?.currency);
                          const previewText = `${item.brandEmoji}${item.formatName}${
                            item.formatStrengthLabel ? ' ' + item.formatStrengthLabel : ''
                          } (${item.formatUnitPrice || 0} ${curSym})\n• ${item.name}`;

                          return (
                            <motion.div
                              key={item.flavorId}
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="space-y-2"
                            >
                              <div className="flex items-center justify-between rounded-lg border border-success/20 bg-secondary/50 p-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.brandEmoji} {item.formatName}
                                  </p>
                                  {receiveItems.length === 1 && (
                                    <div className="mt-2">
                                      <label className="text-[10px] text-muted-foreground">Закупка ({curSym})</label>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        placeholder="Опционально"
                                        value={item.customCostPrice ?? ''}
                                        onChange={(e) => {
                                          const v = filterNonNegativeDecimalInput(e.target.value);
                                          setReceiveItems((prev) =>
                                            prev.map((i) => {
                                              if (i.flavorId !== item.flavorId) return i;
                                              if (v === '') return { ...i, customCostPrice: undefined };
                                              const n = parseFloat(v);
                                              if (!Number.isFinite(n)) return { ...i, customCostPrice: undefined };
                                              return { ...i, customCostPrice: Math.max(0, n) };
                                            }),
                                          );
                                        }}
                                        className="mt-0.5 h-7 w-24 rounded border border-border bg-background px-2 text-xs"
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10"
                                    aria-label={`Уменьшить количество: ${lineLabel}`}
                                    onClick={() =>
                                      setReceiveItems((prev) =>
                                        prev.map((i) =>
                                          i.flavorId === item.flavorId
                                            ? { ...i, addQty: Math.max(1, i.addQty - 1) }
                                            : i,
                                        ),
                                      )
                                    }
                                  >
                                    <Minus size={12} />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-semibold text-success">{item.addQty}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10"
                                    aria-label={`Увеличить количество: ${lineLabel}`}
                                    onClick={() =>
                                      setReceiveItems((prev) =>
                                        prev.map((i) =>
                                          i.flavorId === item.flavorId ? { ...i, addQty: i.addQty + 1 } : i,
                                        ),
                                      )
                                    }
                                  >
                                    <Plus size={12} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-destructive"
                                    aria-label={`Удалить из приёмки: ${lineLabel}`}
                                    onClick={() =>
                                      setReceiveItems((prev) => prev.filter((i) => i.flavorId !== item.flavorId))
                                    }
                                  >
                                    <X size={12} />
                                  </Button>
                                </div>
                              </div>
                              <div className="rounded-lg border border-border/50 bg-muted/50 p-2">
                                <p className="mb-1 text-xs text-muted-foreground">Предпросмотр поста</p>
                                <pre className="whitespace-pre-wrap font-mono text-xs">{previewText}</pre>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <Button
                    type="button"
                    className="h-14 w-full rounded-[18px] text-base font-semibold shadow-lg gradient-primary"
                    onClick={() => setShowScanCamera(true)}
                  >
                    <ScanLine size={22} className="mr-2 shrink-0" />
                    Сканировать
                  </Button>
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
              <Button
                className="w-full gradient-primary"
                onClick={confirmReceive}
                disabled={receiveItems.length === 0 || isReceiving || receiveBatch.isPending}
              >
                Принять ({receiveItems.reduce((s, i) => s + i.addQty, 0)} шт)
              </Button>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ScanModal
        open={showScanCamera}
        closeOnScan
        onOpenChange={(isOpen) => {
          setShowScanCamera(isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
        onScan={(code) => {
          processBarcode(code, { silent: true });
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
    strengthLabel: '', // Жидкости/снюс: мг; кастомные поля strength_label
    ohmValue: '', // Расходники: номинал Ом
    consumablePackQty: '', // Расходники: опционально — доп. текст к позиции (вкус/подпись)
    piecesPerPack: '1',
    flavorName: '',
    costPrice: '' as number | string,
    packCost: '' as number | string,
    unitPrice: '' as number | string,
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
      return areSimilar(normalizeEntityName(b.name), normalizeEntityName(formData.brandName));
    });
  }, [formData.brandName, formData.categoryId, brands]);

  const brandsInCategory = useMemo(
    () => brands.filter((b: any) => b.categoryId === formData.categoryId),
    [brands, formData.categoryId],
  );

  const selectedCategory = categories.find((c: any) => c.id === formData.categoryId);
  const isLiquidCategory = selectedCategory?.name?.toLowerCase().includes('жидкост') || 
                           selectedCategory?.name?.toLowerCase().includes('liquid');
  const isDeviceCategory = selectedCategory?.name?.toLowerCase().includes('устройств') || 
                           selectedCategory?.name?.toLowerCase().includes('device');
  const isSnusCategory = selectedCategory?.name?.toLowerCase().includes('снюс') || 
                         selectedCategory?.name?.toLowerCase().includes('snus');
  const catNameLower = selectedCategory?.name?.toLowerCase() || '';
  const isConsumableCategory =
    catNameLower.includes('расходник') ||
    catNameLower.includes('расходн') ||
    catNameLower.includes('consumable');
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
            f.brandId === formData.brandId && normalizeEntityName(f.name) === normalizeEntityName(computedFormatName)
          );
          formatName = selectedFormat?.name || computedFormatName;
        } else {
          if (isConsumableCategory && formData.ohmValue) {
            const computedFormatName = `${selectedBrand?.name || ''} ${formData.ohmValue}`;
            const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && normalizeEntityName(f.name) === normalizeEntityName(computedFormatName)
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
    onError: (error: unknown) => {
      console.error('Create error:', error);
      const message =
        error instanceof ApiException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Не удалось создать товар';
      toast({
        title: 'Ошибка',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let legacyConsumableOhmNormalized: string | undefined;
    let consumableExtraLabel: string | undefined;
    
    if (isNewBrand && similarBrands.length > 0) {
      toast({
        title: 'Похожий бренд уже есть',
        description: 'Выберите существующий бренд или измените название.',
        variant: 'destructive',
      });
      return;
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
    const packCostValue =
      typeof formData.packCost === 'string'
        ? formData.packCost === ''
          ? 0
          : parseFloat(formData.packCost) || 0
        : formData.packCost;
    const piecesPerPackValue =
      typeof formData.piecesPerPack === 'number'
        ? formData.piecesPerPack
        : parsePositiveInt(String(formData.piecesPerPack ?? ''), 0);
    const effectiveCostPrice =
      isConsumableCategory && packCostValue > 0 && piecesPerPackValue > 0
        ? packCostValue / piecesPerPackValue
        : costPriceValue;
    if (costPriceValue < 0) {
      toast({
        title: 'Ошибка',
        description: 'Себестоимость (закупка) не может быть отрицательной',
        variant: 'destructive',
      });
      return;
    }

    if (isConsumableCategory && packCostValue > 0 && piecesPerPackValue <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Для расходников укажите количество штук в упаковке',
        variant: 'destructive',
      });
      return;
    }

    if (effectiveCostPrice > unitPriceValue + 0.005) {
      toast({
        title: 'Ошибка',
        description: 'Себестоимость за штуку не может быть больше розничной цены',
        variant: 'destructive',
      });
      return;
    }

    const hasCategoryCustomFields = !!(
      selectedCategory?.customFields && selectedCategory.customFields.length > 0
    );

    // Обязательные кастомные поля категории
    if (hasCategoryCustomFields) {
      const missingFields = selectedCategory!.customFields.filter(
        (f: any) =>
          f.required &&
          (f.target === 'flavor_name'
            ? !formData.flavorName
            : f.target === 'strength_label'
              ? !formData.strengthLabel
              : !formData.customValues?.[f.name]),
      );

      if (missingFields.length > 0) {
        toast({
          title: 'Ошибка',
          description: `Заполните обязательные поля: ${missingFields.map((f: any) => f.label).join(', ')}`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Расходники: омы нужны всегда (и при своих полях категории — иначе нет formatName на сервере)
    if (isConsumableCategory) {
      if (!formData.ohmValue?.trim()) {
        toast({
          title: 'Ошибка',
          description: 'Введите значение омов (например: 0.4, 1, 0.6)',
          variant: 'destructive',
        });
        return;
      }
      const ohmParsed = normalizeDecimalNumericInput(formData.ohmValue, { min: 0.01, max: 100 });
      if (!ohmParsed.ok) {
        const desc =
          ohmParsed.reason === 'range'
            ? 'Номинал омов: от 0,01 до 100 (целое или с точкой/запятой, например 4 или 0,8).'
            : 'Номинал омов: введите число (например 4, 0.8, 1,2 или 0,15).';
        toast({
          title: 'Ошибка',
          description: desc,
          variant: 'destructive',
        });
        return;
      }
      legacyConsumableOhmNormalized = ohmParsed.normalized;

      if (formData.consumablePackQty?.trim()) {
        consumableExtraLabel = formData.consumablePackQty.trim();
      }
    }

    // Legacy-валидация без кастомных полей категории
    if (!hasCategoryCustomFields) {
      if (!isConsumableCategory) {
        if (isDeviceCategory || isDisposableCategory) {
          if (!formData.flavorName?.trim()) {
            toast({
              title: 'Ошибка',
              description: isDisposableCategory ? 'Введите вкус' : 'Введите цвет устройства',
              variant: 'destructive',
            });
            return;
          }
        } else {
          if (!formData.flavorName?.trim()) {
            toast({
              title: 'Ошибка',
              description: 'Введите название вкуса',
              variant: 'destructive',
            });
            return;
          }
        }
      }

      if (isLiquidCategory && isNewBrand && !formData.strengthLabel?.trim()) {
        toast({
          title: 'Ошибка',
          description: 'Введите крепость (мг)',
          variant: 'destructive',
        });
        return;
      }

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
      costPrice: Math.max(0, effectiveCostPrice),
      unitPrice: unitPriceValue,
      quantity: formData.quantity,
      customValues: Object.keys(allCustomValues).length > 0 ? allCustomValues : undefined,
    };
    if (isConsumableCategory) {
      payload.piecesPerPack = piecesPerPackValue > 0 ? piecesPerPackValue : 1;
      payload.packCost = Math.max(0, packCostValue);
      payload.costPerPiece = Math.max(0, effectiveCostPrice);
    }

    if (hasCategoryCustomFields) {
      payload.flavorName = formData.flavorName;
      payload.strengthLabel = formData.strengthLabel;
    } else {
      payload.flavorName =
        isDeviceCategory || isDisposableCategory
          ? formData.flavorName
          : isConsumableCategory
            ? ''
            : formData.flavorName;
      payload.strengthLabel = formData.strengthLabel;
    }

    if (isConsumableCategory) {
      payload.ohmValue = legacyConsumableOhmNormalized ?? formData.ohmValue.trim();
      payload.resistanceValue = consumableExtraLabel;
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
      
      if (hasCategoryCustomFields) {
          if (isConsumableCategory && legacyConsumableOhmNormalized) {
            payload.formatName = `${formData.brandName} ${legacyConsumableOhmNormalized}`;
          } else if (formData.strengthLabel) {
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
      
      if (hasCategoryCustomFields) {
           let formatName = selectedBrand?.name || '';
           if (isConsumableCategory && legacyConsumableOhmNormalized) {
             formatName = `${selectedBrand?.name || ''} ${legacyConsumableOhmNormalized}`.trim();
           } else if (formData.strengthLabel) {
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
              f.brandId === formData.brandId && normalizeEntityName(f.name) === normalizeEntityName(formatName)
            );
            if (selectedFormat) {
              payload.formatId = selectedFormat.id;
            } else {
              payload.formatName = formatName;
            }
          } else if (selectedBrand) {
            const selectedFormat = productFormats.find((f: any) => 
              f.brandId === formData.brandId && normalizeEntityName(f.name) === normalizeEntityName(selectedBrand.name)
            );
            if (selectedFormat) {
              payload.formatId = selectedFormat.id;
            } else {
              payload.formatName = selectedBrand.name;
            }
          }
      }
    }
    
    // Нормализация крепости (не для расходников — иначе «20» в кастомном поле превратится в mg)
    if (
      payload.strengthLabel &&
      (isLiquidCategory ||
        isSnusCategory ||
        isDisposableCategory ||
        (hasCategoryCustomFields && !isConsumableCategory))
    ) {
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
      <DialogContent
        className="glass-card border-border max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
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
                placeholder="Штрихкод (необяз.)"
                title="Оставьте пустым, если штрихкода нет — тогда товар без штрихкода"
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
            <p className="text-[11px] text-muted-foreground leading-snug">
              Если штрихкода нет — не заполняйте поле; товар будет без штрихкода.
            </p>
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
                    consumablePackQty: '',
                    piecesPerPack: '1',
                    packCost: '',
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
              ) : brandsInCategory.length === 0 ? (
                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <p>В этой категории ещё нет брендов — создайте линейку вручную.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-[10px]"
                    onClick={() => {
                      setIsNewBrand(true);
                      setFormData({ ...formData, brandId: '', brandName: '', brandEmoji: '' });
                    }}
                  >
                    Создать новый бренд
                  </Button>
                </div>
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
                      consumablePackQty: '',
                      piecesPerPack: '1',
                      packCost: '',
                      unitPrice:
                        selectedFormat && (selectedFormat.unitPrice ?? 0) !== 0
                          ? String(selectedFormat.unitPrice)
                          : formData.unitPrice,
                      customValues: {},
                    });
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm">
                    <SelectValue placeholder="Выберите бренд" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {brandsInCategory.map((b: any) => (
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
                          setFormData({
                            ...formData,
                            strengthLabel: filterStrengthNumericInput(val),
                          });
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
                    inputMode="decimal"
                    value={formData.strengthLabel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        strengthLabel: filterStrengthNumericInput(e.target.value),
                      })
                    }
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
                    inputMode="decimal"
                    value={formData.strengthLabel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        strengthLabel: filterStrengthNumericInput(e.target.value),
                      })
                    }
                    placeholder="50"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Введите число, "mg" добавится автоматически
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

          {isConsumableCategory && (formData.brandName || formData.brandId) && (
            <>
              <div className="space-y-2">
                <Label>Омы (номинал)</Label>
                <Input
                  value={formData.ohmValue}
                  onChange={(e) => setFormData({ ...formData, ohmValue: e.target.value })}
                  placeholder="Например 0.8, 4 или 1,2"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  От 0,01 до 100 Ом — как на койле или упаковке
                </p>
              </div>
              {formData.ohmValue?.trim() ? (
                <div className="space-y-2">
                  <Label>Дополнение к названию (необязательно)</Label>
                  <Input
                    value={formData.consumablePackQty}
                    onChange={(e) =>
                      setFormData({ ...formData, consumablePackQty: e.target.value })
                    }
                    placeholder="Например: 5 шт, Mesh, красный"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Любой текст — будет показан рядом с омами в списке товаров, если заполнить
                  </p>
                </div>
              ) : null}
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:order-1">
              <Label>Себестоимость ({getCurrencySymbol(shopData?.currency)})</Label>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={formData.costPrice === '' ? '' : String(formData.costPrice)}
                onChange={(e) => {
                  setFormData({ ...formData, costPrice: filterNonNegativeDecimalInput(e.target.value) });
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                placeholder="0"
              />
            </div>
            <div className="space-y-2 sm:order-2">
              <Label>Цена продажи ({getCurrencySymbol(shopData?.currency)})</Label>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={formData.unitPrice === '' ? '' : String(formData.unitPrice)}
                onChange={(e) => {
                  setFormData({ ...formData, unitPrice: filterNonNegativeDecimalInput(e.target.value) });
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
            <p className="text-[10px] text-muted-foreground leading-snug sm:col-span-2 sm:order-3">
              Сначала себестоимость за вкус, затем розничная цена линейки (общая для всех вкусов этой линейки) — как в окне редактирования товара.
            </p>
          </div>

          {isConsumableCategory && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Стоимость упаковки</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={formData.packCost === '' ? '' : String(formData.packCost)}
                  onChange={(e) => {
                    setFormData({ ...formData, packCost: filterNonNegativeDecimalInput(e.target.value) });
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Штук в упаковке</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.piecesPerPack === '' || formData.piecesPerPack == null ? '' : String(formData.piecesPerPack)}
                  onChange={(e) => {
                    const next = filterDigitsOnly(e.target.value);
                    setFormData({ ...formData, piecesPerPack: next });
                  }}
                  placeholder="1"
                />
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                Себестоимость за штуку:{' '}
                {formData.packCost !== '' &&
                formData.packCost != null &&
                parseNonNegativeDecimal(String(formData.packCost), 0) > 0 &&
                parsePositiveInt(String(formData.piecesPerPack ?? ''), 0) > 0
                  ? (
                      parseNonNegativeDecimal(String(formData.packCost), 0) /
                      parsePositiveInt(String(formData.piecesPerPack), 0)
                    ).toFixed(2)
                  : parseNonNegativeDecimal(
                      typeof formData.costPrice === 'string' ? formData.costPrice : String(formData.costPrice ?? ''),
                      0,
                    ).toFixed(2)}{' '}
                {getCurrencySymbol(shopData?.currency)}
              </div>
            </div>
          )}

          {/* Preview */}
          {(() => {
            const curSym = getCurrencySymbol(shopData?.currency);
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
                
                if (isConsumableCategory && formData.consumablePackQty?.trim()) {
                  flavorDisplay = formData.consumablePackQty.trim();
                } else {
                  flavorDisplay = flavorName || fieldLabel;
                }
            }

            const previewText = `${brandEmoji || ''}${displayFormatName}${brandEmoji || ''}: (${unitPrice || 0} ${curSym})\n• ${flavorDisplay}`;

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
                (isConsumableCategory && !formData.ohmValue?.trim()) ||
                (selectedCategory?.customFields && selectedCategory.customFields.length > 0
                  ? selectedCategory.customFields.some((f: any) => 
                      f.required && (
                        f.target === 'flavor_name' ? !formData.flavorName :
                        f.target === 'strength_label' ? !formData.strengthLabel :
                        !formData.customValues?.[f.name]
                      )
                    )
                  : (
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

