/**
 * Утилита для управления темой приложения
 */

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'dark';

/**
 * Получить текущую тему из localStorage
 */
export function getTheme(): Theme {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }
  
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  return savedTheme || DEFAULT_THEME;
}

/**
 * Установить тему и сохранить в localStorage
 */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Применить тему к документу
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Инициализировать тему при загрузке страницы
 * Должна вызываться синхронно до первого рендера
 */
export function initTheme(): void {
  const theme = getTheme();
  applyTheme(theme);
}
