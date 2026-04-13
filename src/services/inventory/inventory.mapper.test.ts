import { describe, expect, it } from 'vitest';
import type { Brand, Category, Flavor, ProductFormat, StockItem } from '@/lib/db/entities';
import {
  buildFilteredInventoryItems,
  buildStockMapByFlavorId,
  matchesInventoryListFilters,
  parseInventoryListFilters,
} from '@/services/inventory/inventory.mapper';

const cat = (id: string, name = 'C'): Category =>
  ({
    id,
    shopId: 's1',
    name,
    sortOrder: 0,
    emoji: '',
    customFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Category;

const brand = (id: string, categoryId: string): Brand =>
  ({
    id,
    shopId: 's1',
    categoryId,
    name: 'B',
    sortOrder: 0,
    emojiPrefix: '',
    photoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Brand;

const format = (id: string, brandId: string, unitPrice = 10): ProductFormat =>
  ({
    id,
    shopId: 's1',
    brandId,
    name: 'F',
    strengthLabel: '20mg',
    unitPrice,
    isActive: true,
    isLiquid: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as ProductFormat;

const flavor = (id: string, formatId: string, name = 'Vanilla'): Flavor =>
  ({
    id,
    shopId: 's1',
    productFormatId: formatId,
    name,
    sku: null,
    barcode: null,
    normalizedName: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Flavor;

const stock = (flavorId: string, qty: number, reserved = 0): StockItem =>
  ({
    id: 'st-' + flavorId,
    shopId: 's1',
    flavorId,
    quantity: qty,
    postQuantity: 0,
    reservedQuantity: reserved,
    costPrice: 1,
    packCost: null,
    piecesPerPack: null,
    costPerPiece: null,
    minThreshold: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as StockItem;

describe('parseInventoryListFilters', () => {
  it('parses flags from URLSearchParams', () => {
    const p = new URLSearchParams('inStockOnly=1&search=ab');
    const f = parseInventoryListFilters(p);
    expect(f.inStockOnly).toBe(true);
    expect(f.search).toBe('ab');
    expect(f.includeInactive).toBe(false);
  });

  it('parses includeInactive', () => {
    const f = parseInventoryListFilters(new URLSearchParams('includeInactive=1'));
    expect(f.includeInactive).toBe(true);
  });
});

describe('matchesInventoryListFilters', () => {
  const row = {
    category: cat('c1'),
    brand: brand('b1', 'c1'),
    format: format('pf1', 'b1'),
    flavor: flavor('fl1', 'pf1'),
    quantity: 5,
    postQuantity: 0,
    reservedQuantity: 0,
    costPrice: 1,
    barcode: null,
  };

  it('filters by inStockOnly', () => {
    expect(matchesInventoryListFilters(row, { ...parseInventoryListFilters(new URLSearchParams()), inStockOnly: true })).toBe(true);
    expect(
      matchesInventoryListFilters(
        { ...row, quantity: 0 },
        { ...parseInventoryListFilters(new URLSearchParams()), inStockOnly: true },
      ),
    ).toBe(false);
  });

  it('hides inactive flavor or format unless includeInactive', () => {
    const base = parseInventoryListFilters(new URLSearchParams());
    expect(matchesInventoryListFilters({ ...row, flavor: { ...row.flavor, isActive: false } }, base)).toBe(false);
    expect(
      matchesInventoryListFilters({ ...row, flavor: { ...row.flavor, isActive: false } }, { ...base, includeInactive: true }),
    ).toBe(true);
    expect(matchesInventoryListFilters({ ...row, format: { ...row.format, isActive: false } }, base)).toBe(false);
    expect(
      matchesInventoryListFilters({ ...row, format: { ...row.format, isActive: false } }, { ...base, includeInactive: true }),
    ).toBe(true);
  });
});

describe('buildFilteredInventoryItems', () => {
  it('builds one row for simple tree', () => {
    const c = cat('c1');
    const b = brand('b1', 'c1');
    const pf = format('pf1', 'b1');
    const fl = flavor('fl1', 'pf1');
    const st = stock('fl1', 3);
    const map = buildStockMapByFlavorId([st]);
    const items = buildFilteredInventoryItems([c], [b], [pf], [fl], map, parseInventoryListFilters(new URLSearchParams()));
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toBe(3);
  });
});
