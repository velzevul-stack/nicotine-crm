'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Keyboard } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/** Короткое «пи-пи» при успешном чтении (Web Audio). На iOS может заработать после первого тапа. */
function playScanBeep() {
  if (typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const beep = (when: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.1, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.08);
    };
    void ctx.resume().then(() => {
      const t0 = ctx.currentTime;
      beep(t0, 880);
      beep(t0 + 0.1, 1100);
    });
  } catch {
    try {
      navigator.vibrate?.(35);
    } catch {
      /* ignore */
    }
  }
}

/** Частые форматы штрихкодов (не только QR). */
const BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

const MIN_GAP_MS = 500;
const SAME_CODE_COOLDOWN_MS = 2200;

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

  const lastScanAtRef = useRef(0);
  const lastCodeRef = useRef('');

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

    lastScanAtRef.current = 0;
    lastCodeRef.current = '';
    setError(null);
    let cancelled = false;

    const startScanner = async () => {
      await stopScanner();
      if (cancelled) return;

      try {
        const scanner = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          useBarCodeDetectorIfSupported: true,
        });
        scannerRef.current = scanner;

        const vw = typeof window !== 'undefined' ? window.innerWidth : 320;
        // Компактное окно: не на весь экран; для 1D — широкая «полоска»
        const maxPreviewW = Math.min(260, vw - 40);

        const config = {
          fps: 4,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const w = Math.min(maxPreviewW, Math.floor(viewfinderWidth * 0.92));
            const h = Math.min(100, Math.max(72, Math.floor(viewfinderHeight * 0.22)));
            return { width: w, height: h };
          },
          aspectRatio: 1.6,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 640, max: 960 },
            height: { ideal: 480, max: 720 },
          } as MediaTrackConstraints,
        };

        const onDecoded = (decodedText: string) => {
          const text = decodedText.trim();
          if (!text) return;
          const now = Date.now();
          if (now - lastScanAtRef.current < MIN_GAP_MS) return;
          if (text === lastCodeRef.current && now - lastScanAtRef.current < SAME_CODE_COOLDOWN_MS) return;

          lastScanAtRef.current = now;
          lastCodeRef.current = text;

          playScanBeep();
          onScanRef.current(text);
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
      playScanBeep();
      onScan(manualCode.trim());
      onOpenChange(false);
      setManualCode('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Скан штрихкода
          </DialogTitle>
          <DialogDescription className="text-left text-xs text-muted-foreground">
            EAN, Code 128, UPC и др. Звук при успешном чтении. Повтор того же кода — не чаще чем раз в ~2 с.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!error ? (
            <div className="mx-auto w-full max-w-[260px]">
              <div
                key={readerId}
                id={readerId}
                className="w-full h-[200px] overflow-hidden rounded-xl bg-black border border-white/10 shadow-inner [&_video]:object-cover [&_video]:max-h-[200px]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-center text-sm">
                {error}
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={retryCamera}>
                Повторить
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Поднесите штрихкод к горизонтальной зоне в центре, держите ровно и при хорошем свете.
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
