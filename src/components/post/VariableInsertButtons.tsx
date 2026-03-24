'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VariableInsertButtonsProps {
  onInsert: (variable: string) => void;
}

const variables = {
  'Основные': [
    { label: 'Весь контент', value: '{content}', desc: 'Вставит все категории, бренды, форматы и вкусы' },
  ],
  'Категории': [
    { label: 'Название категории', value: '{category.name}', desc: 'Название категории' },
    { label: 'Эмодзи категории', value: '{category.emoji}', desc: 'Эмодзи категории' },
  ],
  'Бренды': [
    { label: 'Название бренда', value: '{brand.name}', desc: 'Название бренда' },
    { label: 'Эмодзи бренда', value: '{brand.emojiPrefix}', desc: 'Префикс эмодзи бренда' },
  ],
  'Форматы': [
    { label: 'Название формата', value: '{format.name}', desc: 'Название формата продукта' },
    { label: 'Цена формата', value: '{format.price}', desc: 'Число; символ валюты — через {currency}' },
    { label: 'Крепость', value: '{format.strength}', desc: 'Крепость (если есть)' },
  ],
  'Вкусы': [
    { label: 'Название вкуса', value: '{flavor.name}', desc: 'Название вкуса' },
    { label: 'Остаток вкуса', value: '{flavor.stock}', desc: 'Количество в наличии' },
  ],
  'Магазин': [
    { label: 'Название магазина', value: '{shop.name}', desc: 'Название вашего магазина' },
    { label: 'Адрес магазина', value: '{shop.address}', desc: 'Адрес магазина' },
    { label: 'Символ валюты', value: '{currency}', desc: 'Из настроек магазина (₽, $, BYN…)' },
    { label: 'Код валюты', value: '{currencyCode}', desc: 'ISO-код: BYN, USD, RUB…' },
  ],
};

const conditions = [
  { label: 'Если есть вкусы', value: '{if:hasFlavors}\n  // ваш текст\n{/if}', desc: 'Показывать блок только если есть вкусы' },
  { label: 'Если есть остаток', value: '{if:hasStock}\n  // ваш текст\n{/if}', desc: 'Показывать блок только если есть остаток' },
  { label: 'Если вкусы скрыты', value: '{if:!showFlavors}\n  // ваш текст\n{/if}', desc: 'Показывать блок если вкусы не показываются' },
];

const loops = [
  { label: 'Цикл по категориям', value: '{loop:categories}\n  {category.name}\n{/loop}', desc: 'Перебрать все категории' },
  { label: 'Цикл по брендам', value: '{loop:brands}\n  {brand.name}\n{/loop}', desc: 'Перебрать все бренды (внутри категории)' },
  { label: 'Цикл по форматам', value: '{loop:formats}\n  {format.name} - {format.price} {currency}\n{/loop}', desc: 'Перебрать все форматы (внутри бренда)' },
  { label: 'Цикл по вкусам', value: '{loop:flavors}\n  • {flavor.name}\n{/loop}', desc: 'Перебрать все вкусы (внутри формата)' },
];

export function VariableInsertButtons({ onInsert }: VariableInsertButtonsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* Основные переменные */}
        {variables['Основные'].map((v) => (
          <Button
            key={v.value}
            variant="outline"
            size="sm"
            onClick={() => onInsert(v.value)}
            className="text-xs"
            title={v.desc}
          >
            <Plus size={12} className="mr-1" />
            {v.label}
          </Button>
        ))}

        {/* Dropdown для категорий */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Категории
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Переменные категорий</DropdownMenuLabel>
            {variables['Категории'].map((v) => (
              <DropdownMenuItem
                key={v.value}
                onClick={() => onInsert(v.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown для брендов */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Бренды
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Переменные брендов</DropdownMenuLabel>
            {variables['Бренды'].map((v) => (
              <DropdownMenuItem
                key={v.value}
                onClick={() => onInsert(v.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown для форматов */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Форматы
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Переменные форматов</DropdownMenuLabel>
            {variables['Форматы'].map((v) => (
              <DropdownMenuItem
                key={v.value}
                onClick={() => onInsert(v.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown для вкусов */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Вкусы
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Переменные вкусов</DropdownMenuLabel>
            {variables['Вкусы'].map((v) => (
              <DropdownMenuItem
                key={v.value}
                onClick={() => onInsert(v.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown для магазина */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Магазин
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Переменные магазина</DropdownMenuLabel>
            {variables['Магазин'].map((v) => (
              <DropdownMenuItem
                key={v.value}
                onClick={() => onInsert(v.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown для условий */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Условия
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Условные блоки</DropdownMenuLabel>
            {conditions.map((c) => (
              <DropdownMenuItem
                key={c.value}
                onClick={() => onInsert(c.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-xs text-muted-foreground">{c.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown для циклов */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus size={12} className="mr-1" />
              Циклы
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Циклы</DropdownMenuLabel>
            {loops.map((l) => (
              <DropdownMenuItem
                key={l.value}
                onClick={() => onInsert(l.value)}
                className="flex flex-col items-start"
              >
                <span className="font-medium">{l.label}</span>
                <span className="text-xs text-muted-foreground">{l.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
