'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInventoryFilters } from '@/hooks/useInventoryFilters';
import { QuickFilters, CategoryFilter, StrengthFilter, ColorFilter, PriceFilter } from './FilterComponents';
import { getActiveFiltersForCategory } from '@/lib/smart-filters-config';
import { useHintSeen } from '@/hooks/use-hint-seen';

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
  strengths: string[];
  brands: any[];
  colors?: string[];
}

export function FilterModal({
  open,
  onOpenChange,
  categories,
  strengths,
  brands,
  colors = [],
}: FilterModalProps) {
  const [showHint, markSeen] = useHintSeen('inventory-filter');
  const { filters, updateFilters, resetFilters, hasActiveFilters } = useInventoryFilters();
  const [localFilters, setLocalFilters] = useState(filters);

  // Синхронизируем локальные фильтры с URL при открытии
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  useEffect(() => {
    if (!open) {
      markSeen();
    }
  }, [open, markSeen]);

  const handleApply = () => {
    updateFilters(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters = {
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
    setLocalFilters(resetFilters);
    updateFilters(resetFilters);
  };

  // Получаем активные фильтры для выбранной категории
  const selectedCategory = categories.find((c) => c.id === localFilters.selectedCategory);
  const activeFilters = getActiveFiltersForCategory(
    localFilters.selectedCategory,
    selectedCategory?.name
  );
  const showStrengthFilter = activeFilters.some((f) => f.key === 'strength') && strengths.length > 0;
  const showColorFilter = activeFilters.some((f) => f.key === 'color') && colors.length > 0;

  // Фильтруем бренды по категории
  const filteredBrands = localFilters.selectedCategory
    ? brands.filter((b) => b.categoryId === localFilters.selectedCategory)
    : brands;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Фильтры</DialogTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Сбросить все
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Быстрый доступ - всегда виден */}
          <QuickFilters
            filters={localFilters}
            onFiltersChange={(updates) =>
              setLocalFilters({ ...localFilters, ...updates })
            }
          />

          {/* Категории - всегда видна */}
          <CategoryFilter
            filters={localFilters}
            categories={categories}
            onFiltersChange={(updates) =>
              setLocalFilters({ ...localFilters, ...updates })
            }
          />

          {/* Умные фильтры: показываем крепость только если она нужна для категории */}
          {showStrengthFilter && (
            <StrengthFilter
              filters={localFilters}
              strengths={strengths}
              onFiltersChange={(updates) =>
                setLocalFilters({ ...localFilters, ...updates })
              }
            />
          )}

          {/* Умные фильтры: показываем цвет только если он нужен для категории (устройства) */}
          {showColorFilter && (
            <ColorFilter
              filters={localFilters}
              colors={colors}
              onFiltersChange={(updates) =>
                setLocalFilters({ ...localFilters, ...updates })
              }
            />
          )}

          {/* Бренды - показываем только если выбрана категория */}
          {localFilters.selectedCategory && filteredBrands.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-foreground">Бренд</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() =>
                    setLocalFilters({ ...localFilters, selectedBrand: null })
                  }
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    localFilters.selectedBrand === null
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
                  }`}
                >
                  Все бренды
                </button>
                {filteredBrands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() =>
                      setLocalFilters({
                        ...localFilters,
                        selectedBrand:
                          localFilters.selectedBrand === brand.id ? null : brand.id,
                      })
                    }
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      localFilters.selectedBrand === brand.id
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                        : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
                    }`}
                  >
                    <span className="mr-2.5 text-base">{brand.emojiPrefix}</span>
                    {brand.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Подсказка: если категория не выбрана, показываем сообщение */}
          {showHint && !localFilters.selectedCategory && (
            <div className="p-3 rounded-lg bg-secondary/80 border border-border text-sm text-muted-foreground">
              Выберите категорию, чтобы увидеть дополнительные фильтры
            </div>
          )}

          {/* Цена - всегда видна */}
          <PriceFilter
            filters={localFilters}
            onFiltersChange={(updates) =>
              setLocalFilters({ ...localFilters, ...updates })
            }
          />
        </div>

        <div className="flex gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleReset} className="flex-1" disabled={!hasActiveFilters}>
            Сбросить
          </Button>
          <Button onClick={handleApply} className="flex-1 gradient-primary text-primary-foreground">
            Применить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
