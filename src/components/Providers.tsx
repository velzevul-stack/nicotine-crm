'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { applyTelegramMiniAppSwipeGuard } from '@/lib/telegram-mini-app';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTelegramMiniAppSwipeGuard();
    const t = window.setTimeout(applyTelegramMiniAppSwipeGuard, 400);
    return () => clearTimeout(t);
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 минута - данные считаются свежими
            gcTime: 5 * 60 * 1000, // 5 минут - время хранения в кэше (ранее cacheTime)
            refetchOnWindowFocus: false, // Не обновлять при фокусе окна
            retry: 1, // Повторить запрос 1 раз при ошибке
          },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
