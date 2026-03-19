'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
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
