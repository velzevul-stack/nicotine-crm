'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} />
            Произошла ошибка
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            К сожалению, произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-md">
              <p className="text-xs font-mono text-destructive">
                {error.name}: {error.message}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" className="flex-1">
              <RefreshCw size={16} className="mr-2" />
              Попробовать снова
            </Button>
            <Button onClick={() => window.location.reload()} className="flex-1">
              Обновить страницу
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
