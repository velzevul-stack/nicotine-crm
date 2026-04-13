import { getDataSource } from '@/lib/db/data-source';
import type { ShopContext } from '@/services/common/service-context';
import {
  buildEnrichedFlavorsForInventory,
  buildFilteredInventoryItems,
  buildStockMapByFlavorId,
  categoriesWithDefaultCustomFields,
  parseInventoryListFilters,
} from '@/services/inventory/inventory.mapper';
import { loadInventoryBaseRows } from '@/services/inventory/inventory.repository';

export async function getInventorySnapshot(context: ShopContext, searchParams: URLSearchParams) {
  const ds = await Promise.race([
    getDataSource(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 10000),
    ),
  ]);

  const filters = parseInventoryListFilters(searchParams);

  const { categories, brands, formats, flavors, stocks } = await loadInventoryBaseRows(ds, context.shopId);

  const stockMap = buildStockMapByFlavorId(stocks);
  const items = buildFilteredInventoryItems(categories, brands, formats, flavors, stockMap, filters);
  const enrichedFlavors = buildEnrichedFlavorsForInventory(flavors, formats, brands, categories, stockMap);

  return {
    items,
    categories: categoriesWithDefaultCustomFields(categories),
    brands,
    productFormats: formats,
    flavors: enrichedFlavors,
  };
}
