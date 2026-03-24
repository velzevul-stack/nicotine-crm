/**
 * Разбор суммы из поля ввода (запятая как десятичный разделитель, пробелы).
 * Возвращает null, если ввод не является положительным конечным числом.
 */
export function parsePositiveMoneyInput(raw: string): number | null {
  let s = raw.trim().replace(/[\s\u00A0\u202F]/g, '');
  if (!s) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
