'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

export function ScanModal({ open, onOpenChange, onScan }: ScanModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanAttempt, setScanAttempt] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const readerId = `qr-reader-${scanAttempt}`;

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
  }, []);

  const retryCamera = useCallback(() => {
    setError(null);
    setScanAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setError(null);
      return;
    }

    setError(null);
    let cancelled = false;

    const startScanner = async () => {
      await stopScanner();
      if (cancelled) return;

      try {
        const scanner = new Html5Qrcode(readerId, { verbose: false });
        scannerRef.current = scanner;

        const w = typeof window !== 'undefined' ? window.innerWidth : 320;
        const qrboxSize = Math.min(280, Math.max(200, w - 48));

        const config = {
          fps: 12,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1.0,
          // Непрерывный автофокус там, где браузер поддерживает (частично на Android)
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          } as MediaTrackConstraints,
        };

        const onDecoded = (decodedText: string) => {
          onScanRef.current(decodedText);
        };

        try {
          await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => {});
        } catch {
          const devices = await Html5Qrcode.getCameras();
          if (!devices?.length) {
            if (!cancelled) setError('Камера не найдена');
            return;
          }
          const back = devices.find((d) => /back|rear|environment|задн/i.test(d.label));
          const cameraId = back?.id ?? devices[devices.length - 1].id;
          await scanner.start(cameraId, config, onDecoded, () => {});
        }
      } catch (err: unknown) {
        console.error(err);
        const e = err as { name?: string };
        const name = e?.name ?? '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError(
            'Нет доступа к камере. Откройте настройки сайта (значок замка в адресной строке), разрешите камеру и нажмите «Повторить».'
          );
        } else {
          setError('Не удалось включить камеру. Нажмите «Повторить» или введите код вручную.');
        }
      }
    };

    const timer = window.setTimeout(() => {
      void startScanner();
    }, 180);

    let removePermListener: (() => void) | undefined;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((status) => {
          const onChange = () => {
            if (status.state === 'granted' && open) {
              setError(null);
              setScanAttempt((n) => n + 1);
            }
          };
          status.addEventListener('change', onChange);
          removePermListener = () => status.removeEventListener('change', onChange);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      removePermListener?.();
      void stopScanner();
    };
  }, [open, scanAttempt, readerId, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onOpenChange(false);
      setManualCode('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Сканирование штрихкода
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!error ? (
            <div
              key={readerId}
              id={readerId}
              className="w-full min-h-[220px] overflow-hidden rounded-lg bg-black"
            />
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-center text-sm">
                {error}
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={retryCamera}>
                Повторить
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                В веб-приложении тап по экрану для фокуса обычно недоступен — при плоском изображении
                поднесите штрихкод ближе и держите ровно.
              </p>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Или введите вручную</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 min-w-0 sm:flex-row">
            <div className="relative flex-1 min-w-0">
              <Keyboard className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Штрихкод..."
                className="pl-9"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
            </div>
            <Button type="submit" className="shrink-0 sm:w-auto w-full" disabled={!manualCode.trim()}>
              OK
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
