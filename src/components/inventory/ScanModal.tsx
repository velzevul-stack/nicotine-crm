'use client';

import { useEffect, useRef, useState } from 'react';
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'reader';

  useEffect(() => {
    if (open) {
      // Initialize scanner
      const startScanner = async () => {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length) {
            const cameraId = devices[devices.length - 1].id; // Prefer back camera usually last
            const scanner = new Html5Qrcode(regionId);
            scannerRef.current = scanner;
            
            await scanner.start(
              cameraId, 
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
              },
              (decodedText) => {
                onScan(decodedText);
                // Don't stop scanner - keep it running for continuous scanning
                // Scanner will continue until user closes modal manually
              },
              (errorMessage) => {
                // Ignore parse errors, they happen every frame
              }
            );
          } else {
            setError('Камера не найдена');
          }
        } catch (err) {
          console.error(err);
          setError('Ошибка доступа к камере');
        }
      };

      // Small delay to ensure DOM is ready
      setTimeout(startScanner, 100);
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
  };

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
            <div id={regionId} className="w-full overflow-hidden rounded-lg bg-black" />
          ) : (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-center text-sm">
              {error}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Или введите вручную
              </span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Штрихкод..."
                className="pl-9"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!manualCode.trim()}>
              OK
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
