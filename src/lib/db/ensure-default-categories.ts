import type { DataSource } from 'typeorm';
import { CategoryEntity } from './entities';

/** Базовый набор категорий для нового магазина (как в db:seed). */
export const DEFAULT_SHOP_CATEGORIES = [
  { name: 'Жидкости', sortOrder: 1, emoji: '💨' },
  { name: 'Устройства', sortOrder: 2, emoji: '🔋' },
  { name: 'Расходники', sortOrder: 3, emoji: '🔧' },
  { name: 'Снюс', sortOrder: 4, emoji: '📦' },
  { name: 'Одноразки', sortOrder: 5, emoji: '🚬' },
] as const;

/**
 * Если у магазина ещё нет ни одной категории — создаём стандартный набор.
 * Удалять категории по-прежнему можно; пустой склад снова получит набор при следующем GET /categories.
 */
export async function ensureDefaultCategoriesForShop(
  ds: DataSource,
  shopId: string
): Promise<void> {
  const repo = ds.getRepository(CategoryEntity);
  const count = await repo.count({ where: { shopId } });
  if (count > 0) return;

  for (const c of DEFAULT_SHOP_CATEGORIES) {
    await repo.save(
      repo.create({
        shopId,
        name: c.name,
        sortOrder: c.sortOrder,
        emoji: c.emoji,
        customFields: [],
      })
    );
  }
}
