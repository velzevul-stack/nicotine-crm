'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getActiveFiltersForCategory } from '@/lib/smart-filters-config';
import { useHintSeen } from '@/hooks/use-hint-seen';

interface PostFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    selectedCategories: string[];
    selectedBrands: string[];
    selectedStrengths: string[];
    selectedColors: string[];
  };
  onFiltersChange: (filters: PostFiltersModalProps['filters']) => void;
  categories: any[];
  brands: any[];
  strengths: string[];
  colors?: string[];
}

export function PostFiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  categories,
  brands,
  strengths,
  colors = [],
}: PostFiltersModalProps) {
  const [showHint, markSeen] = useHintSeen('post-filters');
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!open) {
      markSeen();
    }
  }, [open, markSeen]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters = {
      selectedCategories: [],
      selectedBrands: [],
      selectedStrengths: [],
      selectedColors: [],
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const toggleCategory = (categoryId: string) => {
    setLocalFilters(prev => {
      const isRemoving = prev.selectedCategories.includes(categoryId);
      const newCategories = isRemoving
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId];
      
      // Фильтруем бренды - оставляем только те, которые относятся к выбранным категориям
      const validBrandIds = brands
        .filter((b: any) => newCategories.length === 0 || newCategories.includes(b.categoryId))
        .map((b: any) => b.id);
      
      const filteredBrands = prev.selectedBrands.filter(id => validBrandIds.includes(id));
      
          // Если убираем категорию и крепость/цвет были релевантны только для неё, сбрасываем их
          let newStrengths = prev.selectedStrengths;
          let newColors = prev.selectedColors;
          if (isRemoving) {
            const removedCategory = categories.find((c) => c.id === categoryId);
            if (removedCategory) {
              const activeFilters = getActiveFiltersForCategory(categoryId, removedCategory.name);
              const hasStrengthFilter = activeFilters.some((f) => f.key === 'strength');
              const hasColorFilter = activeFilters.some((f) => f.key === 'color');
              
              // Проверяем, остались ли другие категории с крепостью
              const hasOtherStrengthCategories = newCategories.some((catId) => {
                const cat = categories.find((c) => c.id === catId);
                if (!cat) return false;
                const filters = getActiveFiltersForCategory(catId, cat.name);
                return filters.some((f) => f.key === 'strength');
              });
              
              // Проверяем, остались ли другие категории с цветом
              const hasOtherColorCategories = newCategories.some((catId) => {
                const cat = categories.find((c) => c.id === catId);
                if (!cat) return false;
                const filters = getActiveFiltersForCategory(catId, cat.name);
                return filters.some((f) => f.key === 'color');
              });
              
              // Если больше нет категорий с крепостью, сбрасываем выбранные крепости
              if (hasStrengthFilter && !hasOtherStrengthCategories) {
                newStrengths = [];
              }
              
              // Если больше нет категорий с цветом, сбрасываем выбранные цвета
              if (hasColorFilter && !hasOtherColorCategories) {
                newColors = [];
              }
            }
          }
          
          return {
            ...prev,
            selectedCategories: newCategories,
            selectedBrands: filteredBrands,
            selectedStrengths: newStrengths,
            selectedColors: newColors,
          };
    });
  };

  const toggleBrand = (brandId: string) => {
    setLocalFilters(prev => {
      const brand = brands.find((b: any) => b.id === brandId);
      if (!brand) return prev;
      
      // Если выбраны категории, проверяем что бренд относится к одной из них
      if (prev.selectedCategories.length > 0 && !prev.selectedCategories.includes(brand.categoryId)) {
        return prev; // Не позволяем выбрать бренд из другой категории
      }
      
      const isAdding = !prev.selectedBrands.includes(brandId);
      const newBrands = isAdding
        ? [...prev.selectedBrands, brandId]
        : prev.selectedBrands.filter(id => id !== brandId);
      
      // Если добавляем бренд и его категория не выбрана, автоматически добавляем категорию
      const newCategories = isAdding && !prev.selectedCategories.includes(brand.categoryId)
        ? [...prev.selectedCategories, brand.categoryId]
        : prev.selectedCategories;
      
      return {
        ...prev,
        selectedCategories: newCategories,
        selectedBrands: newBrands,
      };
    });
  };

  const toggleStrength = (strength: string) => {
    setLocalFilters(prev => ({
      ...prev,
      selectedStrengths: prev.selectedStrengths.includes(strength)
        ? prev.selectedStrengths.filter(s => s !== strength)
        : [...prev.selectedStrengths, strength],
    }));
  };

  const toggleColor = (color: string) => {
    setLocalFilters(prev => ({
      ...prev,
      selectedColors: prev.selectedColors.includes(color)
        ? prev.selectedColors.filter(c => c !== color)
        : [...prev.selectedColors, color],
    }));
  };

  // Определяем, нужно ли показывать фильтр крепости
  // Показываем только если выбраны категории, где крепость релевантна
  const shouldShowStrengthFilter = useMemo(() => {
    if (localFilters.selectedCategories.length === 0) {
      // Если категории не выбраны, не показываем крепость
      return false;
    }
    
    // Проверяем, есть ли среди выбранных категорий хотя бы одна, где крепость релевантна
    return localFilters.selectedCategories.some((catId) => {
      const category = categories.find((c) => c.id === catId);
      if (!category) return false;
      
      const activeFilters = getActiveFiltersForCategory(catId, category.name);
      return activeFilters.some((f) => f.key === 'strength');
    });
  }, [localFilters.selectedCategories, categories]);

  // Определяем, нужно ли показывать фильтр цвета
  // Показываем только если выбраны категории, где цвет релевантен (устройства)
  const shouldShowColorFilter = useMemo(() => {
    if (localFilters.selectedCategories.length === 0) {
      // Если категории не выбраны, не показываем цвет
      return false;
    }
    
    // Проверяем, есть ли среди выбранных категорий хотя бы одна, где цвет релевантен
    return localFilters.selectedCategories.some((catId) => {
      const category = categories.find((c) => c.id === catId);
      if (!category) return false;
      
      const activeFilters = getActiveFiltersForCategory(catId, category.name);
      return activeFilters.some((f) => f.key === 'color');
    });
  }, [localFilters.selectedCategories, categories]);

  // Фильтруем бренды по выбранным категориям
  const filteredBrands = useMemo(() => {
    if (localFilters.selectedCategories.length === 0) {
      return brands;
    }
    return brands.filter((brand: any) =>
      localFilters.selectedCategories.includes(brand.categoryId)
    );
  }, [brands, localFilters.selectedCategories]);

  const hasActiveFilters =
    localFilters.selectedCategories.length > 0 ||
    localFilters.selectedBrands.length > 0 ||
    localFilters.selectedStrengths.length > 0 ||
    localFilters.selectedColors.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-[#F5F5F7]">Фильтры для поста</DialogTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 text-xs text-[#9CA3AF] hover:text-[#F5F5F7]"
              >
                Сбросить все
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Категории */}
          {categories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-[#F5F5F7]">Категории</h3>
              <div className="space-y-1.5">
                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                      localFilters.selectedCategories.includes(cat.id)
                        ? 'bg-[#BFE7E5]/20 text-[#BFE7E5] ring-2 ring-[#BFE7E5]'
                        : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                    }`}
                  >
                    <span className="mr-2.5 text-base">{cat.emoji}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Бренды - показываем только если выбраны категории */}
          {localFilters.selectedCategories.length > 0 && filteredBrands.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-[#F5F5F7]">Бренды</h3>
              <div className="space-y-1.5">
                {filteredBrands.map((brand: any) => (
                  <button
                    key={brand.id}
                    onClick={() => toggleBrand(brand.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                      localFilters.selectedBrands.includes(brand.id)
                        ? 'bg-[#BFE7E5]/20 text-[#BFE7E5] ring-2 ring-[#BFE7E5]'
                        : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                    }`}
                  >
                    <span className="mr-2.5 text-base">{brand.emojiPrefix}</span>
                    {brand.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Умный фильтр крепости - показываем только если выбраны релевантные категории */}
          {shouldShowStrengthFilter && strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-[#F5F5F7]">Крепость</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    // Если все крепости выбраны, снимаем выбор, иначе выбираем все
                    const allSelected = strengths.every(s => localFilters.selectedStrengths.includes(s));
                    setLocalFilters({
                      ...localFilters,
                      selectedStrengths: allSelected ? [] : [...strengths],
                    });
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                    strengths.every(s => localFilters.selectedStrengths.includes(s))
                      ? 'bg-[#BFE7E5]/20 text-[#BFE7E5] ring-2 ring-[#BFE7E5]'
                      : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                  }`}
                >
                  Все крепости
                </button>
                {strengths.map((strength: string) => (
                  <button
                    key={strength}
                    onClick={() => toggleStrength(strength)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                      localFilters.selectedStrengths.includes(strength)
                        ? 'bg-[#BFE7E5]/20 text-[#BFE7E5] ring-2 ring-[#BFE7E5]'
                        : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {strength}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Умный фильтр цвета - показываем только если выбраны релевантные категории (устройства) */}
          {shouldShowColorFilter && colors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-[#F5F5F7]">Цвет</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    // Если все цвета выбраны, снимаем выбор, иначе выбираем все
                    const allSelected = colors.every(c => localFilters.selectedColors.includes(c));
                    setLocalFilters({
                      ...localFilters,
                      selectedColors: allSelected ? [] : [...colors],
                    });
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                    colors.every(c => localFilters.selectedColors.includes(c))
                      ? 'bg-[#BFE7E5]/20 text-[#BFE7E5] ring-2 ring-[#BFE7E5]'
                      : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                  }`}
                >
                  Все цвета
                </button>
                {colors.map((color: string) => (
                  <button
                    key={color}
                    onClick={() => toggleColor(color)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                      localFilters.selectedColors.includes(color)
                        ? 'bg-[#BFE7E5]/20 text-[#BFE7E5] ring-2 ring-[#BFE7E5]'
                        : 'bg-[#0F1115] hover:bg-[#1B2030] text-[#9CA3AF] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Подсказка: если категории не выбраны */}
          {showHint && localFilters.selectedCategories.length === 0 && (
            <div className="p-3 rounded-[14px] bg-[#0F1115] border border-[#1B2030] text-sm text-[#9CA3AF]">
              Выберите категории, чтобы увидеть дополнительные фильтры
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t border-[#1B2030]">
          <Button variant="outline" onClick={handleReset} className="flex-1 border-[#1B2030] text-[#9CA3AF] hover:bg-[#1B2030] hover:text-[#F5F5F7]" disabled={!hasActiveFilters}>
            Сбросить
          </Button>
          <Button variant="default" onClick={handleApply} className="flex-1">
            Применить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
