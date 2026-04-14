import { describe, expect, it } from 'vitest';
import { formatStockProductDisplayLabel } from '@/lib/stock-movement-log';

describe('formatStockProductDisplayLabel', () => {
  it('не дублирует бренд, если имя линейки начинается с бренда', () => {
    expect(
      formatStockProductDisplayLabel({
        brandName: 'Elf Bar',
        formatName: 'Elf Bar 50 mg',
        flavorName: 'Кола',
      }),
    ).toBe('Elf Bar 50 mg Кола');
  });

  it('склеивает бренд и линейку, если линейка без префикса бренда', () => {
    expect(
      formatStockProductDisplayLabel({
        brandName: 'Voopoo',
        formatName: 'Drag X',
        flavorName: 'Чёрный',
      }),
    ).toBe('Voopoo Drag X Чёрный');
  });

  it('если линейка совпадает с брендом — одна часть', () => {
    expect(
      formatStockProductDisplayLabel({
        brandName: 'X',
        formatName: 'X',
        flavorName: 'Вкус',
      }),
    ).toBe('X Вкус');
  });

  it('только вкус, если нет бренда и линейки', () => {
    expect(
      formatStockProductDisplayLabel({
        brandName: '',
        formatName: '',
        flavorName: 'Лимон',
      }),
    ).toBe('Лимон');
  });
});
