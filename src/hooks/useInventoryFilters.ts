'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export interface InventoryFilters {
  inStockOnly: boolean;
  noBarcode: boolean;
  showReservedOnly: boolean;
  selectedCategory: string | null;
  selectedStrength: string | null;
  selectedBrand: string | null;
  selectedColor: string | null;
  minPrice: string;
  maxPrice: string;
}

const defaultFilters: InventoryFilters = {
  inStockOnly: false,
  noBarcode: false,
  showReservedOnly: false,
  selectedCategory: null,
  selectedStrength: null,
  selectedBrand: null,
  selectedColor: null,
  minPrice: '',
  maxPrice: '',
};

export function useInventoryFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Читаем фильтры из URL
  const filters = useMemo<InventoryFilters>(() => ({
    inStockOnly: searchParams.get('inStockOnly') === '1',
    noBarcode: searchParams.get('noBarcode') === '1',
    showReservedOnly: searchParams.get('showReservedOnly') === '1',
    selectedCategory: searchParams.get('categoryId') || null,
    selectedStrength: searchParams.get('strength') || null,
    selectedBrand: searchParams.get('brandId') || null,
    selectedColor: searchParams.get('color') || null,
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
  }), [searchParams]);

  // Обновляем фильтры через URL
  const updateFilters = useCallback((updates: Partial<InventoryFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Обновляем параметры
    if (updates.inStockOnly !== undefined) {
      if (updates.inStockOnly) params.set('inStockOnly', '1');
      else params.delete('inStockOnly');
    }
    if (updates.noBarcode !== undefined) {
      if (updates.noBarcode) params.set('noBarcode', '1');
      else params.delete('noBarcode');
    }
    if (updates.showReservedOnly !== undefined) {
      if (updates.showReservedOnly) params.set('showReservedOnly', '1');
      else params.delete('showReservedOnly');
    }
    if (updates.selectedCategory !== undefined) {
      if (updates.selectedCategory) params.set('categoryId', updates.selectedCategory);
      else params.delete('categoryId');
    }
    if (updates.selectedStrength !== undefined) {
      if (updates.selectedStrength) params.set('strength', updates.selectedStrength);
      else params.delete('strength');
    }
    if (updates.selectedBrand !== undefined) {
      if (updates.selectedBrand) params.set('brandId', updates.selectedBrand);
      else params.delete('brandId');
    }
    if (updates.selectedColor !== undefined) {
      if (updates.selectedColor) params.set('color', updates.selectedColor);
      else params.delete('color');
    }
    if (updates.minPrice !== undefined) {
      if (updates.minPrice) params.set('minPrice', updates.minPrice);
      else params.delete('minPrice');
    }
    if (updates.maxPrice !== undefined) {
      if (updates.maxPrice) params.set('maxPrice', updates.maxPrice);
      else params.delete('maxPrice');
    }

    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  // Сброс всех фильтров
  const resetFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  // Проверка наличия активных фильтров
  const hasActiveFilters = useMemo(() => {
    return (
      filters.inStockOnly ||
      filters.noBarcode ||
      filters.showReservedOnly ||
      filters.selectedCategory !== null ||
      filters.selectedStrength !== null ||
      filters.selectedBrand !== null ||
      filters.selectedColor !== null ||
      filters.minPrice !== '' ||
      filters.maxPrice !== ''
    );
  }, [filters]);

  return {
    filters,
    updateFilters,
    resetFilters,
    hasActiveFilters,
  };
}
