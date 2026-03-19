/**
 * Convert flat inventory items to nested category/format/flavor structure
 * for components that expect Premium-Dark format
 */

import type { NestedCategory, NestedFormat, NestedFlavor } from './api-types';

interface FlatItem {
  category: { id: string; name: string; emoji?: string };
  brand: { id: string; emojiPrefix?: string; name?: string };
  format: { id: string; name: string; strengthLabel?: string; unitPrice?: number };
  flavor: { id: string; name: string; barcode?: string | null };
  quantity: number;
  reservedQuantity: number;
  costPrice: number;
}

export function flatInventoryToNested(items: FlatItem[]): NestedCategory[] {
  const categoryMap = new Map<string, NestedCategory>();
  const formatMap = new Map<string, { categoryId: string; format: NestedFormat }>();

  for (const item of items) {
    const catId = item.category.id;
    const formatId = item.format.id;
    const flavorId = item.flavor.id;

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        id: catId,
        name: item.category.name,
        emoji: item.category.emoji || '📦',
        formats: [],
      });
    }

    let formatEntry = formatMap.get(formatId);
    if (!formatEntry) {
      const format: NestedFormat = {
        id: formatId,
        brandEmoji: (item.brand as { emojiPrefix?: string }).emojiPrefix || '📦',
        name: item.format.name,
        strengthLabel: item.format.strengthLabel,
        unitPrice: item.format.unitPrice ?? 0,
        totalQty: 0,
        totalReserved: 0,
        flavors: [],
      };
      formatEntry = { categoryId: catId, format };
      formatMap.set(formatId, formatEntry);
    }

    const flavor: NestedFlavor = {
      id: flavorId,
      name: item.flavor.name,
      stock: item.quantity,
      reserved: item.reservedQuantity,
      cost: item.costPrice,
      price: item.format.unitPrice ?? 0,
      barcode: item.flavor.barcode ?? undefined,
    };

    formatEntry.format.flavors.push(flavor);
    formatEntry.format.totalQty += item.quantity;
    formatEntry.format.totalReserved += item.reservedQuantity;
  }

  for (const [, entry] of formatMap) {
    const cat = categoryMap.get(entry.categoryId);
    if (cat) {
      const existingFormat = cat.formats.find((f) => f.id === entry.format.id);
      if (!existingFormat) {
        cat.formats.push(entry.format);
      }
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
