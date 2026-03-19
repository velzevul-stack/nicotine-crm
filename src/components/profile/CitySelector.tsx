'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cities, type City as CityData } from '@/lib/data/cities-data';
import { searchCities, getCityDisplayName, cityDataToCity, type SimplifiedCity } from '@/lib/cities-utils';

export type Country = 'RU' | 'BY';

// Re-export SimplifiedCity as City for backward compatibility
export type City = SimplifiedCity;

interface CitySelectorProps {
  value?: { city: string; region: string; country: Country; id?: string } | null;
  onSelect: (city: City | null) => void;
  country: Country;
  disabled?: boolean;
}

export function CitySelector({ value, onSelect, country, disabled }: CitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCities = useMemo(() => {
    const results = searchCities(search, country);
    // Ограничиваем до 50 результатов для производительности
    // Преобразуем полные объекты CityData в упрощенные City
    return results.slice(0, 50).map(cityDataToCity);
  }, [search, country]);

  const selectedCity = useMemo(() => {
    if (!value) return null;
    // Сначала пытаемся найти по id, если он доступен
    let found: CityData | undefined;
    if (value.id) {
      found = cities.find(
        (city) => city.id === value.id && city.country === value.country
      );
    }
    // Если не нашли по id или id не указан, ищем по name и region
    if (!found) {
      found = cities.find(
        (city) =>
          city.name === value.city &&
          city.region === value.region &&
          city.country === value.country
      );
    }
    return found ? cityDataToCity(found) : null;
  }, [value]);

  const displayValue = selectedCity
    ? getCityDisplayName(selectedCity, { includeRegion: true })
    : 'Выберите город';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Поиск города или региона..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Город не найден</CommandEmpty>
            <CommandGroup>
              {filteredCities.map((city) => {
                const isSelected =
                  selectedCity?.name === city.name &&
                  selectedCity?.region === city.region;
                return (
                  <CommandItem
                    key={city.id}
                    value={`${city.name} ${city.region} ${city.nameEn} ${city.regionEn}`}
                    onSelect={() => {
                      // city уже является SimplifiedCity после преобразования в filteredCities
                      onSelect(city);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{city.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {city.region}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
