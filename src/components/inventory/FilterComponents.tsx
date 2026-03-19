'use client';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { InventoryFilters } from '@/hooks/useInventoryFilters';

interface QuickFiltersProps {
  filters: InventoryFilters;
  onFiltersChange: (updates: Partial<InventoryFilters>) => void;
}

export function QuickFilters({ filters, onFiltersChange }: QuickFiltersProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold mb-3 text-foreground">Наличие</h3>
      <div className="space-y-2.5">
        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-secondary/30 transition-colors group">
          <span className="text-sm text-foreground/90">Только в наличии</span>
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) =>
              onFiltersChange({ inStockOnly: e.target.checked })
            }
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-2"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-secondary/30 transition-colors group">
          <span className="text-sm text-foreground/90">Только резервы</span>
          <input
            type="checkbox"
            checked={filters.showReservedOnly}
            onChange={(e) =>
              onFiltersChange({ showReservedOnly: e.target.checked })
            }
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-2"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-secondary/30 transition-colors group">
          <span className="text-sm text-foreground/90">Без штрихкода</span>
          <input
            type="checkbox"
            checked={filters.noBarcode}
            onChange={(e) =>
              onFiltersChange({ noBarcode: e.target.checked })
            }
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-2"
          />
        </label>
      </div>
    </div>
  );
}

interface CategoryFilterProps {
  filters: InventoryFilters;
  categories: any[];
  onFiltersChange: (updates: Partial<InventoryFilters>) => void;
}

export function CategoryFilter({
  filters,
  categories,
  onFiltersChange,
}: CategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 text-foreground">Категория</h3>
      <div className="space-y-1.5">
        <button
          onClick={() => onFiltersChange({ selectedCategory: null })}
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
              onFiltersChange({
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
  );
}

interface StrengthFilterProps {
  filters: InventoryFilters;
  strengths: string[];
  onFiltersChange: (updates: Partial<InventoryFilters>) => void;
}

export function StrengthFilter({
  filters,
  strengths,
  onFiltersChange,
}: StrengthFilterProps) {
  if (strengths.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 text-foreground">Крепость</h3>
      <div className="space-y-1.5">
        <button
          onClick={() => onFiltersChange({ selectedStrength: null })}
          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            filters.selectedStrength === null
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
          }`}
        >
          Все крепости
        </button>
        {strengths.map((strength) => (
          <button
            key={strength}
            onClick={() =>
              onFiltersChange({
                selectedStrength:
                  filters.selectedStrength === strength ? null : strength,
              })
            }
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              filters.selectedStrength === strength
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
            }`}
          >
            {strength}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ColorFilterProps {
  filters: InventoryFilters;
  colors: string[];
  onFiltersChange: (updates: Partial<InventoryFilters>) => void;
}

export function ColorFilter({
  filters,
  colors,
  onFiltersChange,
}: ColorFilterProps) {
  if (colors.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 text-foreground">Цвет</h3>
      <div className="space-y-1.5">
        <button
          onClick={() => onFiltersChange({ selectedColor: null })}
          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            filters.selectedColor === null
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
          }`}
        >
          Все цвета
        </button>
        {colors.map((color) => (
          <button
            key={color}
            onClick={() =>
              onFiltersChange({
                selectedColor:
                  filters.selectedColor === color ? null : color,
              })
            }
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              filters.selectedColor === color
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground'
            }`}
          >
            {color}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PriceFilterProps {
  filters: InventoryFilters;
  onFiltersChange: (updates: Partial<InventoryFilters>) => void;
}

export function PriceFilter({ filters, onFiltersChange }: PriceFilterProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 text-foreground">Цена</h3>
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
              onFiltersChange({ minPrice: e.target.value })
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
              onFiltersChange({ maxPrice: e.target.value })
            }
            className="h-9 text-sm bg-background border-border/50 focus:border-primary/50"
          />
        </div>
      </div>
    </div>
  );
}
