/**
 * Клиентская статистика использования бота
 * Хранится в localStorage и периодически синхронизируется с сервером
 * Оптимизировано для production: отслеживаем только дни использования
 */

const STORAGE_KEY = 'bot_usage_stats';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 минут

export interface ClientStats {
  // Дни использования (храним даты в формате YYYY-MM-DD)
  usageDays: string[];
  // Последняя синхронизация
  lastSyncedAt: string | null;
}

function getDefaultStats(): ClientStats {
  return {
    usageDays: [],
    lastSyncedAt: null,
  };
}

export function getClientStats(): ClientStats {
  if (typeof window === 'undefined') return getDefaultStats();
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultStats();
    return JSON.parse(stored);
  } catch {
    return getDefaultStats();
  }
}

export function saveClientStats(stats: ClientStats): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save client stats:', error);
  }
}

export function trackSession(): void {
  const stats = getClientStats();
  const today = new Date().toISOString().split('T')[0];
  
  // Добавляем сегодняшний день, если его еще нет
  if (!stats.usageDays.includes(today)) {
    stats.usageDays.push(today);
    saveClientStats(stats);
  }
}

export function shouldSync(): boolean {
  const stats = getClientStats();
  if (!stats.lastSyncedAt) return true;
  
  const lastSynced = new Date(stats.lastSyncedAt);
  const now = new Date();
  return now.getTime() - lastSynced.getTime() > SYNC_INTERVAL;
}

export function markSynced(): void {
  const stats = getClientStats();
  stats.lastSyncedAt = new Date().toISOString();
  saveClientStats(stats);
}
