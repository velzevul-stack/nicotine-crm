'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
import {
  getClientStats,
  shouldSync,
  markSynced,
  trackSession,
} from '@/lib/client-stats';

/**
 * Хук для автоматической синхронизации статистики с сервером
 * Использует ручной polling вместо useQuery для лучшей производительности
 */
export function useStatsSync() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    // Отслеживаем новую сессию при монтировании компонента
    trackSession();

    // Функция синхронизации статистики
    const syncStats = async () => {
      // Предотвращаем параллельные синхронизации
      if (isSyncingRef.current || !shouldSync()) {
        return;
      }

      isSyncingRef.current = true;
      try {
        const clientStats = getClientStats();
        // Отправляем только usageDays
        await api('/api/stats/sync', {
          method: 'POST',
          body: { usageDays: clientStats.usageDays },
        });
        markSynced();
      } catch (error) {
        // Тихая ошибка - не блокируем UI
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to sync stats:', error);
        }
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Первая синхронизация при монтировании (если нужно)
    syncStats();

    // Устанавливаем интервал для периодической синхронизации
    intervalRef.current = setInterval(syncStats, 5 * 60 * 1000); // Каждые 5 минут

    // Очистка при размонтировании
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
