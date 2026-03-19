'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Send, Upload, ImageIcon } from 'lucide-react';

const API_BASE = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL ?? '');

interface ExcelSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brands: Array<{ id: string; name: string; emojiPrefix?: string; photoUrl?: string | null }>;
  onBrandPhotoUploaded?: () => void;
}

export function ExcelSettingsModal({
  open,
  onOpenChange,
  brands,
  onBrandPhotoUploaded,
}: ExcelSettingsModalProps) {
  const { toast } = useToast();
  const [includeBrandPhotos, setIncludeBrandPhotos] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingBrandId, setUploadingBrandId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/post/excel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeBrandPhotos }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Ошибка генерации');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'table.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Excel скачан', description: 'Файл table.xlsx сохранён' });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось скачать Excel',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSendToTelegram = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/post/excel/send-telegram`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeBrandPhotos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Ошибка отправки');
      }
      toast({ title: 'Отправлено', description: 'Таблица отправлена в Telegram' });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось отправить в Telegram',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handlePhotoUpload = async (brandId: string, file: File) => {
    setUploadingBrandId(brandId);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch(`${API_BASE}/api/inventory/brand/${brandId}/photo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Ошибка загрузки');
      }
      toast({ title: 'Фото загружено', description: 'Фото бренда обновлено' });
      onBrandPhotoUploaded?.();
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось загрузить фото',
        variant: 'destructive',
      });
    } finally {
      setUploadingBrandId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[92vh] flex flex-col overflow-hidden gap-0 p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0 pr-8">
          <DialogTitle>Настройки таблицы Excel</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 py-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include-brand-photos"
              checked={includeBrandPhotos}
              onChange={(e) => setIncludeBrandPhotos(e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="include-brand-photos">Включать фото брендов в таблицу</Label>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Фото брендов</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Добавьте фото для отображения в Excel.
            </p>
            <div className="space-y-2">
              {brands.map((brand) => (
                <div
                  key={brand.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {brand.photoUrl ? (
                      <img
                        src={brand.photoUrl.startsWith('/') ? `${API_BASE}${brand.photoUrl}` : brand.photoUrl}
                        alt={brand.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {brand.emojiPrefix} {brand.name}
                    </p>
                  </div>
                  <div>
                    <input
                      ref={(el) => { fileInputRefs.current[brand.id] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoUpload(brand.id, f);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs.current[brand.id]?.click()}
                      disabled={uploadingBrandId === brand.id}
                    >
                      {uploadingBrandId === brand.id ? (
                        '...'
                      ) : brand.photoUrl ? (
                        'Изменить'
                      ) : (
                        <>
                          <Upload size={14} className="mr-1" />
                          Загрузить
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 mt-4 border-t border-[#1B2030] !flex !flex-col items-center gap-3">
          <div className="flex gap-2">
            <Button
              variant="default"
              size="lg"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={16} className="mr-2" />
              {downloading ? 'Скачивание...' : 'Скачать Excel'}
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={handleSendToTelegram}
              disabled={sending}
            >
              <Send size={16} className="mr-2" />
              {sending ? 'Отправка...' : 'В Telegram'}
            </Button>
          </div>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
