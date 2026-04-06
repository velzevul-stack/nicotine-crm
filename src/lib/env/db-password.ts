/**
 * Нормализация пароля БД из .env: trim и снятие одной пары обрамляющих кавычек.
 * Некоторые способы деплоя/PM2 передают в process.env литеральные символы " вокруг значения.
 */
export function normalizeDbPassword(raw: string): string {
  // CRLF в .env с Windows и литеральный \r в значении ломают SCRAM vs ручной ввод в bash
  let s = raw.replace(/\r/g, '').replace(/^\uFEFF/, '').trim();
  if (s.length >= 2) {
    const open = s[0];
    const close = s[s.length - 1];
    if ((open === '"' && close === '"') || (open === "'" && close === "'")) {
      s = s.slice(1, -1);
    }
  }
  return s;
}

/** Пароль для TypeORM: если переменная не задана — dev-дефолт postgres. */
export function resolveDbPasswordForTypeorm(): string {
  if (process.env.DB_PASSWORD === undefined) {
    return 'postgres';
  }
  return normalizeDbPassword(process.env.DB_PASSWORD);
}

/** Пароль для скриптов, где пустой пароль недопустим. null = не задан или пусто после нормализации. */
export function parseRequiredDbPassword(): string | null {
  const raw = process.env.DB_PASSWORD;
  if (raw === undefined || raw === null) {
    return null;
  }
  const s = normalizeDbPassword(raw);
  return s.length > 0 ? s : null;
}
