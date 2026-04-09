'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Movement = {
  id: string;
  productId: string;
  productName: string;
  createdAt: string;
  actionType: string;
  fromZone: 'post' | 'warehouse' | null;
  toZone: 'post' | 'warehouse' | null;
  quantity: number;
  postStockBefore: number;
  postStockAfter: number;
  warehouseBefore: number;
  warehouseAfter: number;
  contextType: 'sale' | 'debt' | 'reservation' | null;
  contextId: string | null;
  comment: string | null;
};

type MovementsResponse = {
  rows: Movement[];
  categories: Array<{ categoryId: string; categoryName: string; categoryEmoji: string | null }>;
};

const ACTION_LABELS: Record<string, string> = {
  receipt_to_post: 'Приемка товара',
  receipt_to_warehouse: 'Приемка товара',
  sale: 'Продажа',
  reservation_sale: 'Продажа резерва',
  debt_sale: 'Продажа в долг',
  cancel_sale: 'Отмена продажи',
  manual_transfer: 'Корректировка остатков',
  manual_decrease: 'Ручное списание',
  clear_stock: 'Очистка остатков',
};

function zoneLabel(zone: 'post' | 'warehouse' | null): string {
  if (zone === 'post') return 'Витрина';
  if (zone === 'warehouse') return 'Склад';
  return 'Без зоны';
}

function zoneFlowLabel(fromZone: Movement['fromZone'], toZone: Movement['toZone']): string {
  if (fromZone === 'warehouse' && toZone === 'post') return 'Обновление витрины';
  if (fromZone === 'post' && toZone === 'warehouse') return 'Обновление витрины';
  if (!fromZone && !toZone) return 'Изменение остатков';
  if (!fromZone && toZone) return 'Изменение остатков';
  if (fromZone && !toZone) return 'Изменение остатков';
  return `${zoneLabel(fromZone)} -> ${zoneLabel(toZone)}`;
}

function contextLabel(type: Movement['contextType'], id: string | null): string {
  if (!type || !id) return '-';
  const short = id.slice(0, 8);
  if (type === 'sale') return `Чек #${short}`;
  if (type === 'debt') return `Долг #${short}`;
  if (type === 'reservation') return `Резерв #${short}`;
  return `${type} #${short}`;
}

export function StockMovementsPanel({ items }: { items: Array<{ flavor: { id: string; name: string }; category?: { id?: string; name?: string; emoji?: string } }> }) {
  const [categoryId, setCategoryId] = useState<string>('all');
  const [actionType, setActionType] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);
  const [showFilters, setShowFilters] = useState(false);
  const [draftCategoryId, setDraftCategoryId] = useState<string>('all');
  const [draftActionType, setDraftActionType] = useState<string>('all');
  const [draftFromDate, setDraftFromDate] = useState<string>('');
  const [draftToDate, setDraftToDate] = useState<string>('');
  const [draftLimit, setDraftLimit] = useState<number>(100);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scrollPaused, setScrollPaused] = useState(false);
  const scrollPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHistoryScroll = useCallback(() => {
    setScrollPaused(true);
    if (scrollPauseTimerRef.current) clearTimeout(scrollPauseTimerRef.current);
    scrollPauseTimerRef.current = setTimeout(() => {
      setScrollPaused(false);
      scrollPauseTimerRef.current = null;
    }, 8000);
  }, []);

  useEffect(
    () => () => {
      if (scrollPauseTimerRef.current) clearTimeout(scrollPauseTimerRef.current);
    },
    []
  );

  const fallbackCategoryOptions = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const item of items) {
      if (!item.category?.id || uniq.has(item.category.id)) continue;
      const emoji = item.category.emoji ? `${item.category.emoji} ` : '';
      const label = `${emoji}${item.category.name || 'Без названия'}`.trim();
      uniq.set(item.category.id, label || item.category.id);
    }
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['inventory-movements', categoryId, actionType, fromDate, toDate, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (categoryId !== 'all') params.set('categoryId', categoryId);
      if (actionType !== 'all') params.set('actionType', actionType);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      return api<MovementsResponse>(`/api/inventory/movements?${params.toString()}`);
    },
    refetchInterval: autoRefresh && !scrollPaused ? 10000 : false,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  const movements = Array.isArray(data?.rows) ? data.rows : [];
  const categoryOptions = (Array.isArray(data?.categories) && data.categories.length > 0)
    ? data.categories.map((c) => ({
      id: c.categoryId,
      name: `${c.categoryEmoji ? `${c.categoryEmoji} ` : ''}${c.categoryName}`,
    }))
    : fallbackCategoryOptions;

  const filtersSummary = [
    categoryId !== 'all' ? `Категория: ${categoryOptions.find((c) => c.id === categoryId)?.name || 'Выбрана'}` : 'Все категории',
    actionType !== 'all' ? `Операция: ${ACTION_LABELS[actionType] || actionType}` : 'Все операции',
    fromDate ? `С: ${fromDate}` : null,
    toDate ? `По: ${toDate}` : null,
    `Лимит: ${limit}`,
  ].filter(Boolean).join(' | ');

  return (
    <section className="bg-card rounded-[20px] border border-border p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">История движений</h3>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraftCategoryId(categoryId);
            setDraftActionType(actionType);
            setDraftFromDate(fromDate);
            setDraftToDate(toDate);
            setDraftLimit(limit);
            setShowFilters(true);
          }}
          className="h-10 px-4 rounded-[12px] text-sm font-medium shrink-0"
        >
          Фильтры
        </Button>
      </div>

      <div className="text-xs text-muted-foreground break-words">{filtersSummary}</div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          className="rounded border-border"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
        />
        Автообновление (10 с)
      </label>

      {isError && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm">
          <span className="text-muted-foreground flex-1">
            {error instanceof Error ? error.message : 'Не удалось загрузить историю движений'}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Повторить
          </Button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Загрузка истории...</div>
      ) : isError && !data ? null : movements.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Записей нет</div>
      ) : (
        <div className="max-h-[62vh] overflow-y-auto pr-1" onScroll={handleHistoryScroll}>
          <div className="space-y-3 md:hidden">
            {movements.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-3 bg-background space-y-2">
                <div className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</div>
                <div className="text-sm font-medium break-words">{m.productName}</div>
                <div className="text-xs break-words">{ACTION_LABELS[m.actionType] || m.actionType}</div>
                <div className="text-xs break-words">Перемещение: {zoneFlowLabel(m.fromZone, m.toZone)}</div>
                <div className="text-xs break-words">Кол-во: {m.quantity}</div>
                <div className="text-xs break-words">Витрина: {m.postStockBefore} {'->'} {m.postStockAfter}</div>
                <div className="text-xs break-words">Склад: {m.warehouseBefore} {'->'} {m.warehouseAfter}</div>
                <div className="text-xs break-words">Контекст: {contextLabel(m.contextType, m.contextId)}</div>
                <div className="text-xs break-words text-muted-foreground">{m.comment || '-'}</div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table className="table-fixed min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Когда</TableHead>
                  <TableHead className="w-[250px]">Товар</TableHead>
                  <TableHead className="w-[160px]">Операция</TableHead>
                  <TableHead className="w-[180px]">Перемещение</TableHead>
                  <TableHead className="w-[80px]">Кол-во</TableHead>
                  <TableHead className="w-[120px]">Витрина до/после</TableHead>
                  <TableHead className="w-[130px]">Склад до/после</TableHead>
                  <TableHead className="w-[150px]">Контекст</TableHead>
                  <TableHead className="w-[260px]">Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-normal break-all align-top">{new Date(m.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{m.productName}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{ACTION_LABELS[m.actionType] || m.actionType}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{zoneFlowLabel(m.fromZone, m.toZone)}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{m.quantity}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{m.postStockBefore} {'->'} {m.postStockAfter}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{m.warehouseBefore} {'->'} {m.warehouseAfter}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{contextLabel(m.contextType, m.contextId)}</TableCell>
                    <TableCell className="whitespace-normal break-all align-top">{m.comment || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-[94vw] sm:max-w-lg p-4">
          <DialogHeader>
            <DialogTitle>Фильтры истории</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={draftCategoryId} onValueChange={setDraftCategoryId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={draftActionType} onValueChange={setDraftActionType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Операция" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все операции</SelectItem>
                {Object.keys(ACTION_LABELS).map((key) => (
                  <SelectItem key={key} value={key}>{ACTION_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              type="date"
              value={draftFromDate}
              onChange={(e) => setDraftFromDate(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-border bg-muted px-3 text-sm"
            />
            <input
              type="date"
              value={draftToDate}
              onChange={(e) => setDraftToDate(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-border bg-muted px-3 text-sm"
            />

            <Select value={String(draftLimit)} onValueChange={(v) => setDraftLimit(Number(v))}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Лимит" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[12px]"
                onClick={() => {
                  setDraftCategoryId('all');
                  setDraftActionType('all');
                  setDraftFromDate('');
                  setDraftToDate('');
                  setDraftLimit(100);
                  setCategoryId('all');
                  setActionType('all');
                  setFromDate('');
                  setToDate('');
                  setLimit(100);
                }}
              >
                Сбросить
              </Button>
              <Button
                type="button"
                className="h-11 rounded-[12px]"
                onClick={() => {
                  setCategoryId(draftCategoryId);
                  setActionType(draftActionType);
                  setFromDate(draftFromDate);
                  setToDate(draftToDate);
                  setLimit(draftLimit);
                  setShowFilters(false);
                }}
              >
                Применить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
