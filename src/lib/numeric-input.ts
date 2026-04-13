/**
 * G-03: единое поведение десятичных полей — строка + inputMode="decimal",
 * пустое значение остаётся пустым до отправки (не смешиваем с «0» в соседних полях).
 */

/** Только цифры и одна точка; запятая → точка. */
export function filterNonNegativeDecimalInput(raw: string): string {
  const normalized = raw.replace(/,/g, '.');
  if (normalized === '') return '';
  let out = '';
  let dotSeen = false;
  for (const ch of normalized) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !dotSeen) {
      out += '.';
      dotSeen = true;
    }
  }
  return out;
}

/** Только цифры (целое ≥ 0), пустая строка допустима при вводе. */
export function filterDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function parseNonNegativeDecimal(s: string, fallback = 0): number {
  const t = s.trim();
  if (t === '' || t === '.') return fallback;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function parsePositiveInt(s: string, fallback = 0): number {
  const t = s.trim();
  if (t === '') return fallback;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
