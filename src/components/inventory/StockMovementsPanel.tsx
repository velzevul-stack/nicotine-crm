'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
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
  products: Array<{ productId: string; productName: string }>;
};

const ACTION_LABELS: Record<string, string> = {
  receipt_to_post: 'Приемка в пост',
  receipt_to_warehouse: 'Приемка на склад',
  sale: 'Продажа',
  reservation_sale: 'Продажа резерва',
  debt_sale: 'Продажа в долг',
  cancel_sale: 'Отмена продажи',
  manual_transfer: 'Ручной перенос',
  manual_decrease: 'Ручное списание',
  clear_stock: 'Очистка остатков',
};

function zoneLabel(zone: 'post' | 'warehouse' | null): string {
  if (zone === 'post') return 'post';
  if (zone === 'warehouse') return 'warehouse';
  return '-';
}

function contextLabel(type: Movement['contextType'], id: string | null): string {
  if (!type || !id) return '-';
  const short = id.slice(0, 8);
  if (type === 'sale') return `Чек #${short}`;
  if (type === 'debt') return `Долг #${short}`;
  if (type === 'reservation') return `Резерв #${short}`;
  return `${type} #${short}`;
}

export function StockMovementsPanel({ items }: { items: Array<{ flavor: { id: string; name: string }; brand?: { name?: string }; format?: { name?: string } }> }) {
  const [productId, setProductId] = useState<string>('all');
  const [actionType, setActionType] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);

  const fallbackProductOptions = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const item of items) {
      if (!item.flavor?.id || uniq.has(item.flavor.id)) continue;
      const label = `${item.brand?.name || ''} ${item.format?.name || ''} ${item.flavor?.name || ''}`.replace(/\s+/g, ' ').trim();
      uniq.set(item.flavor.id, label || item.flavor.id);
    }
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['inventory-movements', productId, actionType, fromDate, toDate, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (productId !== 'all') params.set('productId', productId);
      if (actionType !== 'all') params.set('actionType', actionType);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      return api<MovementsResponse>(`/api/inventory/movements?${params.toString()}`);
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  const movements = Array.isArray(data?.rows) ? data.rows : [];
  const productOptions = (Array.isArray(data?.products) && data.products.length > 0)
    ? data.products.map((p) => ({ id: p.productId, name: p.productName }))
    : fallbackProductOptions;

  return (
    <section className="bg-card rounded-[20px] border border-border p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">История движений</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger>
            <SelectValue placeholder="Товар" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все товары</SelectItem>
            {productOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger>
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
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-10 rounded-[14px] border border-border bg-muted px-3 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-10 rounded-[14px] border border-border bg-muted px-3 text-sm"
        />

        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Лимит" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="250">250</SelectItem>
            <SelectItem value="500">500</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Загрузка истории...</div>
      ) : movements.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Записей нет</div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {movements.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-3 bg-background space-y-2">
                <div className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</div>
                <div className="text-sm font-medium break-words">{m.productName}</div>
                <div className="text-xs break-words">{ACTION_LABELS[m.actionType] || m.actionType}</div>
                <div className="text-xs break-words">Зоны: {zoneLabel(m.fromZone)} {'->'} {zoneLabel(m.toZone)}</div>
                <div className="text-xs break-words">Кол-во: {m.quantity}</div>
                <div className="text-xs break-words">Post: {m.postStockBefore} {'->'} {m.postStockAfter}</div>
                <div className="text-xs break-words">Склад: {m.warehouseBefore} {'->'} {m.warehouseAfter}</div>
                <div className="text-xs break-words">Контекст: {contextLabel(m.contextType, m.contextId)}</div>
                <div className="text-xs break-words text-muted-foreground">{m.comment || '-'}</div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table className="table-fixed min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Когда</TableHead>
                  <TableHead className="w-[250px]">Товар</TableHead>
                  <TableHead className="w-[160px]">Операция</TableHead>
                  <TableHead className="w-[130px]">Зоны</TableHead>
                  <TableHead className="w-[80px]">Кол-во</TableHead>
                  <TableHead className="w-[120px]">Post до/после</TableHead>
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
                    <TableCell className="whitespace-normal break-all align-top">{zoneLabel(m.fromZone)} {'->'} {zoneLabel(m.toZone)}</TableCell>
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
        </>
      )}
    </section>
  );
}
