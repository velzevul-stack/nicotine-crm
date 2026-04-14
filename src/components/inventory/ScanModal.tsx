'use client';

import { useEffect, useRef, useState, useCallback, useId } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Keyboard, X, Zap, ZapOff, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { cn } from '@/lib/utils';

const STORAGE_SOUND = 'psp-scan-sound';
const STORAGE_VIBRATE = 'psp-scan-vibrate';
/** Стабильный выбор камеры (Chromium/Android): меньше смены constraints и сюрпризов с доступом. */
const PREFERRED_CAMERA_DEVICE_ID_KEY = 'psp-preferred-camera-device-id';

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
    /* ignore */
  }
}

function vibrateSuccess() {
  try {
    navigator.vibrate?.([35, 55, 35]);
  } catch {
    /* ignore */
  }
}

const BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.MAXICODE,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
];

const MIN_GAP_MS = 420;
const SAME_CODE_COOLDOWN_MS = 1600;
const NOISE_CODE_WINDOW_MS = 850;
const QRBOX_WIDTH_FACTOR = 0.61; // визуальная рамка (не ограничивает декодирование)
const QRBOX_ASPECT_RATIO = 1.5; // ширина к высоте
const FALLBACK_DETECT_INTERVAL_MS = 320;

type BarcodeBounds = { x: number; y: number; width: number; height: number };
type BarcodeDetectorResult = { rawValue?: string; boundingBox?: BarcodeBounds };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<BarcodeDetectorResult[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
type BarcodeDetectorGlobal = { BarcodeDetector?: BarcodeDetectorCtor };

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}

function waitForElementById(elementId: string, isCancelled: () => boolean, maxFrames = 120): Promise<boolean> {
  return new Promise((resolve) => {
    let frames = 0;
    const step = () => {
      if (isCancelled()) {
        resolve(false);
        return;
      }
      if (typeof document !== 'undefined' && document.getElementById(elementId)) {
        resolve(true);
        return;
      }
      frames += 1;
      if (frames >= maxFrames) {
        resolve(!!(typeof document !== 'undefined' && document.getElementById(elementId)));
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

type ScanBanner = { id: string; code: string };

interface ScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
  /** После успешного чтения сразу закрыть камеру (например приёмка). */
  closeOnScan?: boolean;
}

export function ScanModal({ open, onOpenChange, onScan, closeOnScan = false }: ScanModalProps) {
  const baseId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [scanAttempt, setScanAttempt] = useState(0);
  const [banners, setBanners] = useState<ScanBanner[]>([]);
  const [detectedBox, setDetectedBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [scannerEpoch, setScannerEpoch] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const closeOnScanRef = useRef(closeOnScan);
  closeOnScanRef.current = closeOnScan;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const lastScanAtRef = useRef(0);
  const lastCodeRef = useRef('');
  const lastAcceptedRef = useRef<{ code: string; at: number } | null>(null);
  const lastBoxAtRef = useRef(0);
  const fallbackLoopStopRef = useRef<null | (() => void)>(null);
  const soundOnRef = useRef(soundOn);
  const vibrateOnRef = useRef(vibrateOn);
  soundOnRef.current = soundOn;
  vibrateOnRef.current = vibrateOn;

  const readerId = `qr-reader-${baseId}-${scanAttempt}`;

  const stopScanner = useCallback(async () => {
    fallbackLoopStopRef.current?.();
    fallbackLoopStopRef.current = null;
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

  const dismissBanner = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = window.sessionStorage.getItem(STORAGE_SOUND);
    const v = window.sessionStorage.getItem(STORAGE_VIBRATE);
    if (s === '0') setSoundOn(false);
    if (v === '0') setVibrateOn(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_SOUND, soundOn ? '1' : '0');
  }, [soundOn]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_VIBRATE, vibrateOn ? '1' : '0');
  }, [vibrateOn]);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setError(null);
      setBanners([]);
      setDetectedBox(null);
      setShowManual(false);
      setFlashOn(false);
      return;
    }

    lastScanAtRef.current = 0;
    lastCodeRef.current = '';
    lastAcceptedRef.current = null;
    setError(null);
    let cancelled = false;

    const startScanner = async () => {
      await stopScanner();
      if (cancelled) return;

      const domReady = await waitForElementById(readerId, () => cancelled);
      if (!domReady || cancelled) return;

      try {
        const scanner = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          // Для сложных 1D-кодов (в т.ч. EAN/UPC на пачках) JS-декодер часто стабильнее системного BarcodeDetector.
          useBarCodeDetectorIfSupported: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 12,
          disableFlip: false,
        };

        const onDecoded = (decodedText: string) => {
          const text = decodedText.trim();
          if (!text) return;
          const now = Date.now();
          if (now - lastScanAtRef.current < MIN_GAP_MS) return;
          if (text === lastCodeRef.current && now - lastScanAtRef.current < SAME_CODE_COOLDOWN_MS) return;
          const lastAccepted = lastAcceptedRef.current;
          if (lastAccepted && text !== lastAccepted.code && now - lastAccepted.at < NOISE_CODE_WINDOW_MS) {
            return;
          }

          lastScanAtRef.current = now;
          lastCodeRef.current = text;
          lastAcceptedRef.current = { code: text, at: now };

          if (soundOnRef.current) playScanBeep();
          if (vibrateOnRef.current) vibrateSuccess();

          if (!closeOnScanRef.current) {
            const bid = `${now}-${Math.random().toString(36).slice(2, 9)}`;
            setBanners((prev) => [{ id: bid, code: text }, ...prev].slice(0, 5));
          }

          onScanRef.current(text);
          if (closeOnScanRef.current) {
            queueMicrotask(() => onOpenChangeRef.current(false));
          }
        };
        const projectBoundsToViewport = (box: BarcodeBounds, video: HTMLVideoElement) => {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return null;
          const containerW = window.innerWidth;
          const containerH = window.innerHeight;
          const scale = Math.max(containerW / vw, containerH / vh);
          const renderedW = vw * scale;
          const renderedH = vh * scale;
          const offsetX = (containerW - renderedW) / 2;
          const offsetY = (containerH - renderedH) / 2;
          const left = offsetX + box.x * scale;
          const top = offsetY + box.y * scale;
          const width = box.width * scale;
          const height = box.height * scale;
          return {
            left: clampPct((left / containerW) * 100),
            top: clampPct((top / containerH) * 100),
            width: clampPct((width / containerW) * 100),
            height: clampPct((height / containerH) * 100),
          };
        };

        const devices = await Html5Qrcode.getCameras();
        if (!devices?.length) {
          if (!cancelled) setError('Камера не найдена');
          return;
        }
        const preferredRaw =
          typeof window !== 'undefined' ? localStorage.getItem(PREFERRED_CAMERA_DEVICE_ID_KEY) : null;
        const preferred = preferredRaw ? devices.find((d) => d.id === preferredRaw) : undefined;
        const back = devices.find((d) => /back|rear|environment|задн/i.test(d.label));
        const cameraId = preferred?.id ?? back?.id ?? devices[devices.length - 1]?.id;
        if (!cameraId) {
          if (!cancelled) setError('Камера не найдена');
          return;
        }
        await scanner.start(cameraId, config, onDecoded, () => {});
        const applyQualityConstraints = () =>
          scanner
            .applyVideoConstraints({
              width: { ideal: 1280 },
              height: { ideal: 720 },
              advanced: [
                { focusMode: 'continuous' },
                { pointsOfInterest: [{ x: 0.5, y: 0.5 }] },
                { zoom: 1.0 },
                { sharpness: 1 },
                { contrast: 1 },
              ],
            } as unknown as Parameters<Html5Qrcode['applyVideoConstraints']>[0])
            .catch(() => {
              /* часть браузеров/камер игнорирует расширенные constraints */
            });
        applyQualityConstraints();
        window.setTimeout(applyQualityConstraints, 700);
        window.setTimeout(applyQualityConstraints, 1600);

        const globalWithDetector = window as unknown as BarcodeDetectorGlobal;
        if (globalWithDetector.BarcodeDetector) {
          const detector = new globalWithDetector.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code'],
          });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            let stopped = false;
            fallbackLoopStopRef.current = () => {
              stopped = true;
            };
            const tick = async () => {
              if (stopped || cancelled) return;
              const video = document.querySelector<HTMLVideoElement>(`#${readerId} video`);
              if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                const variants = [
                  { sx: 0, sy: 0, sw: vw, sh: vh, contrast: 1.0, scale: 1.0 },
                  { sx: 0, sy: 0, sw: vw, sh: vh, contrast: 1.3, scale: 1.2 },
                  { sx: Math.floor(vw * 0.15), sy: Math.floor(vh * 0.2), sw: Math.floor(vw * 0.7), sh: Math.floor(vh * 0.6), contrast: 1.15, scale: 1.35 },
                  { sx: Math.floor(vw * 0.1), sy: Math.floor(vh * 0.3), sw: Math.floor(vw * 0.8), sh: Math.floor(vh * 0.36), contrast: 1.45, scale: 1.6 },
                ];
                try {
                  const liveResults = await detector.detect(video);
                  const live = liveResults.find((r) => (r.rawValue ?? '').trim() || r.boundingBox);
                  if (live?.boundingBox) {
                    const projected = projectBoundsToViewport(live.boundingBox, video);
                    if (projected) {
                      lastBoxAtRef.current = Date.now();
                      setDetectedBox(projected);
                    }
                  } else if (Date.now() - lastBoxAtRef.current > 850) {
                    setDetectedBox(null);
                  }
                  if ((live?.rawValue ?? '').trim()) {
                    onDecoded(live.rawValue!.trim());
                  }
                } catch {
                  /* ignore detector errors on live video frame */
                }
                for (const v of variants) {
                  for (const angle of [0, 90, 180, 270]) {
                    const rotated = angle === 90 || angle === 270;
                    canvas.width = Math.max(420, Math.floor((rotated ? v.sh : v.sw) * v.scale));
                    canvas.height = Math.max(220, Math.floor((rotated ? v.sw : v.sh) * v.scale));
                    ctx.save();
                    ctx.filter = `contrast(${v.contrast}) saturate(1.1)`;
                    if (angle === 0) {
                      ctx.drawImage(video, v.sx, v.sy, v.sw, v.sh, 0, 0, canvas.width, canvas.height);
                    } else {
                      ctx.translate(canvas.width / 2, canvas.height / 2);
                      ctx.rotate((angle * Math.PI) / 180);
                      ctx.drawImage(video, v.sx, v.sy, v.sw, v.sh, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
                    }
                    ctx.restore();
                    try {
                      const results = await detector.detect(canvas);
                      const value = results.find((r) => (r.rawValue ?? '').trim())?.rawValue?.trim();
                      if (value) {
                        onDecoded(value);
                        break;
                      }
                    } catch {
                      /* ignore detector errors on unsupported frames */
                    }
                  }
                }
              }
              if (!stopped && !cancelled) window.setTimeout(() => void tick(), FALLBACK_DETECT_INTERVAL_MS);
            };
            void tick();
          }
        }
        if (!cancelled && typeof window !== 'undefined') {
          try {
            localStorage.setItem(PREFERRED_CAMERA_DEVICE_ID_KEY, cameraId);
          } catch {
            /* private mode / quota */
          }
        }
        if (!cancelled) setScannerEpoch((n) => n + 1);
      } catch (err: unknown) {
        console.error(err);
        const e = err as { name?: string };
        const name = e?.name ?? '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError(
            'Нет доступа к камере. Откройте настройки сайта (значок замка в адресной строке), разрешите камеру и нажмите «Повторить».',
          );
        } else {
          setError('Не удалось включить камеру. Нажмите «Повторить» или введите код вручную.');
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, scanAttempt, readerId, stopScanner]);

  useEffect(() => {
    if (!open) return;
    const sc = scannerRef.current;
    if (!sc) return;
    const torch = (on: boolean) =>
      ({ advanced: [{ torch: on }] } as unknown as Parameters<Html5Qrcode['applyVideoConstraints']>[0]);
    if (!flashOn) {
      sc.applyVideoConstraints(torch(false)).catch(() => {});
      return;
    }
    sc.applyVideoConstraints(torch(true)).catch(() => {
      /* не все камеры / браузеры поддерживают torch */
    });
    return () => {
      scannerRef.current?.applyVideoConstraints(torch(false)).catch(() => {});
    };
  }, [flashOn, open, scanAttempt, scannerEpoch]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      const text = manualCode.trim();
      if (soundOnRef.current) playScanBeep();
      if (vibrateOnRef.current) vibrateSuccess();
      if (!closeOnScan) {
        const bid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setBanners((prev) => [{ id: bid, code: text }, ...prev].slice(0, 5));
      }
      onScan(text);
      if (closeOnScan) {
        queueMicrotask(() => onOpenChange(false));
      }
      setManualCode('');
      setShowManual(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            'fixed inset-0 z-[201] flex flex-col bg-black outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Скан штрихкода</DialogPrimitive.Title>
          <style>{`
            @keyframes psp-scan-line-y {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(calc(42vmin - 6px)); }
            }
          `}</style>

          {/* Верх: уведомления о считывании — закрываются вручную */}
          <div className="absolute left-0 right-0 top-0 z-[220] flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
            {banners.map((b) => (
              <div
                key={b.id}
                className="pointer-events-auto mx-auto w-full max-w-md rounded-[14px] border border-[#1B2030] bg-[#151922] px-3 py-2.5 text-[#F5F5F7] shadow-lg flex items-start gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#F5E100]">Код принят</p>
                  <p className="text-sm font-mono break-all leading-snug">{b.code}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">Декодирован по всему кадру. Закройте плашку, когда прочитаете.</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-[10px] p-2 text-[#9CA3AF] hover:bg-[#1B2030] hover:text-[#F5F5F7]"
                  aria-label="Закрыть уведомление"
                  onClick={() => dismissBanner(b.id)}
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>

          {/* Камера на весь экран */}
          <div className="absolute inset-0 z-0">
            {!error ? (
              <div
                key={readerId}
                id={readerId}
                className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
                <div className="max-w-sm rounded-[14px] border border-destructive/40 bg-destructive/15 px-4 py-3 text-center text-sm text-destructive">
                  {error}
                </div>
                <Button type="button" variant="secondary" className="rounded-[12px]" onClick={retryCamera}>
                  Повторить
                </Button>
                <p className="max-w-xs text-center text-xs text-[#9CA3AF]">
                  Держите код в кадре при хорошем свете. Нестандартные или фигурные штрихкоды (например на упаковках) считаются тем же движком — если не читается, попробуйте другой ракурс или ввод вручную.
                </p>
              </div>
            )}
          </div>

          {/* Верхняя панель */}
          <div className="relative z-[210] flex items-center justify-between px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
                aria-label="Закрыть сканер"
              >
                <X className="h-6 w-6" strokeWidth={1.5} />
              </button>
            </DialogPrimitive.Close>

            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm',
                  flashOn && 'ring-2 ring-[#F5E100]/80',
                )}
                aria-label={flashOn ? 'Выключить вспышку' : 'Включить вспышку'}
                onClick={() => setFlashOn((v) => !v)}
              >
                {flashOn ? <Zap className="h-5 w-5" strokeWidth={1.5} /> : <ZapOff className="h-5 w-5" strokeWidth={1.5} />}
              </button>
              <button
                type="button"
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm',
                  vibrateOn && 'ring-2 ring-[#F5E100]/80',
                )}
                aria-label={vibrateOn ? 'Выключить вибрацию при скане' : 'Включить вибрацию при скане'}
                onClick={() => setVibrateOn((v) => !v)}
              >
                <Smartphone className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm',
                  soundOn && 'ring-2 ring-[#F5E100]/80',
                )}
                aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
                onClick={() => setSoundOn((v) => !v)}
              >
                {soundOn ? <Volume2 className="h-5 w-5" strokeWidth={1.5} /> : <VolumeX className="h-5 w-5" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Центр: жёлтые углы + линия (визуал); зона распознавания смещена в центр через qrbox */}
          {!error && (
            <div className="pointer-events-none absolute inset-0 z-[205] flex items-center justify-center">
              {detectedBox && (
                <div
                  className="absolute rounded-[4px] border-2 border-[#00E676] shadow-[0_0_14px_rgba(0,230,118,0.75)] transition-all duration-100"
                  style={{
                    left: `${detectedBox.left}%`,
                    top: `${detectedBox.top}%`,
                    width: `${detectedBox.width}%`,
                    height: `${detectedBox.height}%`,
                  }}
                />
              )}
              <div className="relative h-[40.8vmin] w-[61.2vmin] max-h-[44vh] max-w-[78vw]">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-[4px] border-l-[4px] border-t-[4px] border-[#F5E100]" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-[4px] border-r-[4px] border-t-[4px] border-[#F5E100]" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-[4px] border-b-[4px] border-l-[4px] border-[#F5E100]" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-[4px] border-b-[4px] border-r-[4px] border-[#F5E100]" />
                <div
                  className="absolute left-[10%] right-[10%] top-[12%] h-[2px] rounded-full bg-[#F5E100] shadow-[0_0_12px_rgba(245,225,0,0.85)]"
                  style={{ animation: 'psp-scan-line-y 2.4s ease-in-out infinite' }}
                />
              </div>
            </div>
          )}

          {/* Низ: подсказка + ручной ввод */}
          <div className="relative z-[210] mt-auto w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-md rounded-t-[22px] rounded-b-[12px] bg-white px-4 pb-4 pt-3 text-black shadow-[0_-8px_40px_rgba(0,0,0,0.35)]">
              <p className="text-center text-base font-bold">Отсканируйте код</p>
              <p className="mt-1 text-center text-sm text-neutral-600">Наведите камеру на код — поиск по всему кадру</p>
              {!error && (
                <p className="mt-1.5 text-center text-xs leading-snug text-neutral-500">
                  Держите код в ярком свете, на расстоянии 10–25 см; при бликах смените угол. Не читается — «Ввести код вручную».
                </p>
              )}

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-neutral-200 py-2.5 text-sm font-medium text-neutral-800"
                onClick={() => setShowManual((s) => !s)}
              >
                <Keyboard className="h-4 w-4" />
                {showManual ? 'Скрыть ручной ввод' : 'Ввести код вручную'}
              </button>

              {showManual && (
                <form onSubmit={handleManualSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="text"
                    placeholder="Штрихкод или QR…"
                    className="h-11 flex-1 rounded-[12px] border-neutral-300 bg-white text-black"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                  />
                  <Button type="submit" className="h-11 shrink-0 rounded-[12px] sm:w-auto w-full" disabled={!manualCode.trim()}>
                    OK
                  </Button>
                </form>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
