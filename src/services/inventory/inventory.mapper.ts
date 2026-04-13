import type { Brand, Category, Flavor, ProductFormat, StockItem } from '@/lib/db/entities';
import { isConsumableCategoryName } from '@/lib/consumable-category';

export type InventoryItemRow = {
  category: Category;
  brand: Brand;
  format: ProductFormat;
  flavor: Flavor;
  quantity: number;
  postQuantity: number;
  reservedQuantity: number;
  costPrice: number;
  barcode: string | null | undefined;
};

export type InventoryListFilters = {
  search: string;
  inStockOnly: boolean;
  noBarcode: boolean;
  showReservedOnly: boolean;
  /** Показать позиции с выключенным вкусом или неактивной линейкой (по умолчанию скрыты). */
  includeInactive: boolean;
  minPrice: string | null;
  maxPrice: string | null;
  categoryId: string | null;
  strength: string | null;
  brandId: string | null;
  color: string | null;
};

export function parseInventoryListFilters(searchParams: URLSearchParams): InventoryListFilters {
  return {
    search: (searchParams.get('search') ?? '').toLowerCase(),
    inStockOnly: searchParams.get('inStockOnly') === '1',
    noBarcode: searchParams.get('noBarcode') === '1',
    showReservedOnly: searchParams.get('showReservedOnly') === '1',
    includeInactive: searchParams.get('includeInactive') === '1',
    minPrice: searchParams.get('minPrice'),
    maxPrice: searchParams.get('maxPrice'),
    categoryId: searchParams.get('categoryId'),
    strength: searchParams.get('strength'),
    brandId: searchParams.get('brandId'),
    color: searchParams.get('color'),
  };
}

export function categoriesWithDefaultCustomFields(categories: Category[]): Category[] {
  return categories.map((cat) => ({
    ...cat,
    customFields: cat.customFields || [],
  }));
}

export function buildStockMapByFlavorId(stocks: StockItem[]): Map<string, StockItem> {
  return new Map(stocks.map((s) => [s.flavorId, s]));
}

export function buildFilteredInventoryItems(
  categories: Category[],
  brands: Brand[],
  formats: ProductFormat[],
  flavors: Flavor[],
  stockMap: Map<string, StockItem>,
  filters: InventoryListFilters,
): InventoryItemRow[] {
  const categoriesWithDefaults = categoriesWithDefaultCustomFields(categories);

  return categoriesWithDefaults
    .flatMap((cat) =>
      brands
        .filter((b) => b.categoryId === cat.id)
        .flatMap((brand) =>
          formats
            .filter((f) => f.brandId === brand.id)
            .flatMap((format) =>
              flavors
                .filter((f) => f.productFormatId === format.id)
                .map((flavor) => {
                  const stock = stockMap.get(flavor.id);
                  return {
                    category: cat,
                    brand,
                    format,
                    flavor,
                    quantity: stock?.quantity ?? 0,
                    postQuantity: stock?.postQuantity ?? 0,
                    reservedQuantity: stock?.reservedQuantity ?? 0,
                    costPrice: stock?.costPrice ?? 0,
                    barcode: flavor.barcode,
                  };
                }),
            ),
        ),
    )
    .filter((i) => matchesInventoryListFilters(i, filters));
}

export function matchesInventoryListFilters(i: InventoryItemRow, filters: InventoryListFilters): boolean {
  const {
    categoryId,
    brandId,
    strength,
    color,
    showReservedOnly,
    inStockOnly,
    noBarcode,
    includeInactive,
    minPrice,
    maxPrice,
    search,
  } = filters;

  if (!includeInactive && (!i.flavor.isActive || !i.format.isActive)) return false;

  if (categoryId && i.category.id !== categoryId) return false;
  if (brandId && i.brand.id !== brandId) return false;
  if (strength && i.format.strengthLabel !== strength) return false;
  if (color && i.flavor.name.trim().toLowerCase() !== color.trim().toLowerCase()) return false;
  if (showReservedOnly && i.reservedQuantity <= 0) return false;
  if (inStockOnly && i.quantity <= 0) return false;
  if (noBarcode && i.barcode) return false;
  if (minPrice && i.format.unitPrice < parseFloat(minPrice)) return false;
  if (maxPrice && i.format.unitPrice > parseFloat(maxPrice)) return false;
  if (search) {
    const combined = `${i.brand.name} ${i.format.name} ${i.flavor.name} ${i.barcode ?? ''}`.toLowerCase();
    return combined.includes(search);
  }
  return true;
}

export function buildEnrichedFlavorsForInventory(
  flavors: Flavor[],
  formats: ProductFormat[],
  brands: Brand[],
  categories: Category[],
  stockMap: Map<string, StockItem>,
): Array<
  Flavor & {
    quantity: number;
    postQuantity: number;
    reservedQuantity: number;
    isConsumableCategory: boolean;
  }
> {
  const categoriesWithDefaults = categoriesWithDefaultCustomFields(categories);

  return flavors.map((f) => {
    const stock = stockMap.get(f.id);
    const format = formats.find((pf) => pf.id === f.productFormatId);
    const brand = format ? brands.find((b) => b.id === format.brandId) : null;
    const cat = brand ? categoriesWithDefaults.find((c) => c.id === brand.categoryId) : null;
    return {
      ...f,
      quantity: stock?.quantity ?? 0,
      postQuantity: stock?.postQuantity ?? 0,
      reservedQuantity: stock?.reservedQuantity ?? 0,
      isConsumableCategory: isConsumableCategoryName(cat?.name),
    };
  });
}
