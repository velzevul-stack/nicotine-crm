import { flavorAvailableQuantity } from '@/lib/flavor-available-qty';
import type { Brand, Flavor, ProductFormat } from '@/types/api';

export interface SalesSearchItem {
  flavorId: string;
  flavorName: string;
  brandName: string;
  brandEmojiPrefix?: string;
  formatName: string;
  unitPrice: number;
  availableQty: number;
  barcode: string | null;
  searchText: string;
}

export function buildSalesSearchItems(params: {
  flavors: Flavor[];
  productFormats: ProductFormat[];
  brands: Brand[];
}): SalesSearchItem[] {
  const { flavors, productFormats, brands } = params;
  const formatById = new Map(productFormats.map((f) => [f.id, f]));
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const items: SalesSearchItem[] = [];
  for (const flavor of flavors) {
    if (flavor.isActive === false) continue;
    const format = formatById.get(flavor.productFormatId);
    if (!format || format.isActive === false) continue;
    const brand = brandById.get(format.brandId);
    if (!brand) continue;
    const availableQty = flavorAvailableQuantity(flavor);
    if (availableQty <= 0) continue;

    const barcode = flavor.barcode?.trim() || null;
    const searchText = `${brand.name} ${format.name} ${flavor.name} ${barcode ?? ''}`.toLowerCase();
    items.push({
      flavorId: flavor.id,
      flavorName: flavor.name,
      brandName: brand.name,
      brandEmojiPrefix: brand.emojiPrefix,
      formatName: format.name,
      unitPrice: format.unitPrice ?? 0,
      availableQty,
      barcode,
      searchText,
    });
  }
  return items;
}

export function runSalesSearch(params: {
  items: SalesSearchItem[];
  query: string;
  limit?: number;
}): SalesSearchItem[] {
  const { items, query, limit = 40 } = params;
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const exactBarcode: SalesSearchItem[] = [];
  const partial: SalesSearchItem[] = [];

  for (const item of items) {
    if (!item.searchText.includes(q)) continue;
    if (item.barcode && item.barcode.toLowerCase() === q) {
      exactBarcode.push(item);
    } else {
      partial.push(item);
    }
  }

  return [...exactBarcode, ...partial].slice(0, limit);
}
