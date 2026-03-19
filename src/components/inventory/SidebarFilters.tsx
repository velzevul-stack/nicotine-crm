'use client';

import { useMemo } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useInventoryFilters, InventoryFilters } from '@/hooks/useInventoryFilters';
import { getActiveFiltersForCategory } from '@/lib/smart-filters-config';

interface SidebarFiltersProps {
  categories: any[];
  strengths: string[];
  brands: any[];
}

export function SidebarFilters({ categories, strengths, brands }: SidebarFiltersProps) {
  const { filters, updateFilters, resetFilters, hasActiveFilters } = useInventoryFilters();

  // Получаем активные фильтры для выбранной категории
  const activeFilters = useMemo(() => {
    const category = categories.find((c) => c.id === filters.selectedCategory);
    return getActiveFiltersForCategory(
      filters.selectedCategory,
      category?.name
    );
  }, [filters.selectedCategory, categories]);

  // Фильтруем бренды по категории
  const filteredBrands = useMemo(() => {
    if (!filters.selectedCategory) return brands;
    return brands.filter(
      (b) => b.categoryId === filters.selectedCategory
    );
  }, [brands, filters.selectedCategory]);

  const selectedCategory = categories.find(
    (c) => c.id === filters.selectedCategory
  );

  return (
    <div className="w-full md:w-64 lg:w-72 h-full overflow-y-auto bg-background/50 backdrop-blur-sm border-r border-border/50 p-5 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <h2 className="text-base font-semibold text-foreground">Фильтры</h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            title="Сбросить все"
          >
            <RotateCcw size={14} />
          </Button>
        )}
      </div>

      {/* Быстрый доступ */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          Быстрый доступ
        </h3>
        <div className="space-y-2.5">
          <label className="flex items-center justify-between cursor-pointer group p-2 rounded-lg hover:bg-secondary/30 transition-colors">
            <span className="text-sm text-foreground/90">Только в наличии</span>
            <Switch
              checked={filters.inStockOnly}
              onCheckedChange={(checked) =>
                updateFilters({ inStockOnly: checked })
              }
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer group p-2 rounded-lg hover:bg-secondary/30 transition-colors">
            <span className="text-sm text-foreground/90">С резервами</span>
            <Switch
              checked={filters.showReservedOnly}
              onCheckedChange={(checked) =>
                updateFilters({ showReservedOnly: checked })
              }
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer group p-2 rounded-lg hover:bg-secondary/30 transition-colors">
            <span className="text-sm text-foreground/90">Без штрихкода</span>
            <Switch
              checked={filters.noBarcode}
              onCheckedChange={(checked) =>
                updateFilters({ noBarcode: checked })
              }
            />
          </label>
        </div>
      </div>

      {/* Категории */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          Категория
        </h3>
        <div className="space-y-1.5">
          <button
            onClick={() => updateFilters({ selectedCategory: null })}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              filters.selectedCategory === null
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
            }`}
          >
            Все категории
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                updateFilters({
                  selectedCategory:
                    filters.selectedCategory === cat.id ? null : cat.id,
                })
              }
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                filters.selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
              }`}
            >
              <span className="mr-2.5 text-base">{cat.emoji}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Умные фильтры (показываются только если выбрана категория) */}
      {selectedCategory && activeFilters.length > 0 && (
        <Accordion type="single" collapsible defaultValue="" className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Характеристики
          </h3>
          {activeFilters.map((filterConfig) => {
            if (filterConfig.key === 'strength' && strengths.length > 0) {
              return (
                <AccordionItem key={filterConfig.key} value={filterConfig.key} className="border-none">
                  <AccordionTrigger className="text-sm py-2.5 px-3 rounded-xl hover:bg-secondary/30 transition-colors [&[data-state=open]]:bg-secondary/20">
                    <span className="font-medium text-foreground/90">{filterConfig.label}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1.5 pt-2 px-1">
                      <button
                        onClick={() =>
                          updateFilters({ selectedStrength: null })
                        }
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          filters.selectedStrength === null
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-secondary/50 hover:bg-secondary text-foreground/70 hover:text-foreground'
                        }`}
                      >
                        Все {filterConfig.label.toLowerCase()}
                      </button>
                      {strengths.map((strength) => (
                        <button
                          key={strength}
                          onClick={() =>
                            updateFilters({
                              selectedStrength:
                                filters.selectedStrength === strength
                                  ? null
                                  : strength,
                            })
                          }
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            filters.selectedStrength === strength
                              ? 'bg-primary/20 text-primary border border-primary/30'
                              : 'bg-secondary/50 hover:bg-secondary text-foreground/70 hover:text-foreground'
                          }`}
                        >
                          {strength}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            }
            return null;
          })}
        </Accordion>
      )}

      {/* Бренды (если выбрана категория) */}
      {selectedCategory && filteredBrands.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Бренд
          </h3>
          <div className="space-y-1.5">
            <button
              onClick={() => updateFilters({ selectedBrand: null })}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                filters.selectedBrand === null
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
                  updateFilters({
                    selectedBrand:
                      filters.selectedBrand === brand.id ? null : brand.id,
                  })
                }
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  filters.selectedBrand === brand.id
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

      {/* Цена */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          Цена
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground/70 font-medium">
              От
            </label>
            <Input
              type="number"
              placeholder="0"
              value={filters.minPrice}
              onChange={(e) =>
                updateFilters({ minPrice: e.target.value })
              }
              className="h-9 text-sm bg-background border-border/50 focus:border-primary/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground/70 font-medium">
              До
            </label>
            <Input
              type="number"
              placeholder="∞"
              value={filters.maxPrice}
              onChange={(e) =>
                updateFilters({ maxPrice: e.target.value })
              }
              className="h-9 text-sm bg-background border-border/50 focus:border-primary/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
