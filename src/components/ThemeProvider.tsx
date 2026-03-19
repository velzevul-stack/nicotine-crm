'use client';

import { useEffect } from 'react';
import { initTheme } from '@/lib/theme';

/**
 * Компонент для инициализации темы при загрузке приложения
 * Применяет сохраненную тему из localStorage к документу
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTheme();
  }, []);

  return <>{children}</>;
}
