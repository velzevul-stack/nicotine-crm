/**
 * Конфигурация умных фильтров
 * Определяет, какие фильтры показывать для каждой категории
 */

export interface SmartFilterConfig {
  key: string;
  label: string;
  type: 'select' | 'range' | 'checkbox';
  categories: string[]; // ID категорий или слаги (например, 'liquids', 'devices')
  options?: string[]; // Для типа 'select'
}

// Маппинг категорий по слагам (если категории имеют стабильные названия)
// Можно расширить, добавив реальные ID категорий из БД
export const CATEGORY_SLUGS = {
  LIQUIDS: 'liquids',
  DISPOSABLES: 'disposables',
  DEVICES: 'devices',
  CARTRIDGES: 'cartridges',
} as const;

// Конфигурация умных фильтров
export const SMART_FILTERS: SmartFilterConfig[] = [
  {
    key: 'strength',
    label: 'Крепость',
    type: 'select',
    categories: [CATEGORY_SLUGS.LIQUIDS, CATEGORY_SLUGS.DISPOSABLES, CATEGORY_SLUGS.CARTRIDGES],
  },
  {
    key: 'puffs',
    label: 'Затяжки',
    type: 'range',
    categories: [CATEGORY_SLUGS.DISPOSABLES],
  },
  {
    key: 'color',
    label: 'Цвет',
    type: 'select',
    categories: [CATEGORY_SLUGS.DEVICES],
  },
];

/**
 * Проверяет, нужно ли показывать фильтр для выбранной категории
 */
export function shouldShowFilter(
  filterKey: string,
  categoryId: string | null,
  categoryName?: string
): boolean {
  if (!categoryId) return false;

  const filterConfig = SMART_FILTERS.find((f) => f.key === filterKey);
  if (!filterConfig) return false;

  // Проверяем по ID или по названию (для демо-данных)
  const categorySlug = categoryName?.toLowerCase() || '';
  return filterConfig.categories.some(
    (cat) =>
      cat === categoryId ||
      cat === categorySlug ||
      categorySlug.includes(cat)
  );
}

/**
 * Получает список активных фильтров для категории
 */
export function getActiveFiltersForCategory(
  categoryId: string | null,
  categoryName?: string
): SmartFilterConfig[] {
  if (!categoryId) return [];

  const categorySlug = categoryName?.toLowerCase().trim() || '';
  
  return SMART_FILTERS.filter((filter) =>
    filter.categories.some((cat) => {
      // Точное совпадение по ID
      if (cat === categoryId) return true;
      
      // Совпадение по слагу (например, 'liquids')
      const catSlug = cat.toLowerCase();
      if (categorySlug === catSlug) return true;
      
      // Частичное совпадение (например, 'Жидкости' содержит 'liquids')
      // Но только если название категории содержит ключевое слово
      const keywords: Record<string, string[]> = {
        'liquids': ['жидкост', 'liquid'],
        'disposables': ['однораз', 'disposable'],
        'devices': ['устройств', 'device', 'pod', 'мод'],
        'cartridges': ['картридж', 'cartridge'],
      };
      
      const keywordsForCat = keywords[catSlug] || [];
      return keywordsForCat.some((keyword) => categorySlug.includes(keyword));
    })
  );
}
