/** Для полей «крепость в мг»: только цифры и одна десятичная точка. */
export function filterStrengthNumericInput(raw: string): string {
  let out = '';
  let dot = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if ((ch === '.' || ch === ',') && !dot) {
      out += '.';
      dot = true;
    }
  }
  return out;
}

/** Для сохранения крепости жидкостей: только число → «N mg». */
export function normalizeStrengthMgForSave(raw: string): string {
  const digits = filterStrengthNumericInput(raw.trim());
  if (!digits) return '';
  const n = parseFloat(digits);
  if (!Number.isFinite(n) || n < 0) return '';
  return `${n} mg`;
}
