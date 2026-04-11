type ReportKind = 'runtime' | 'boundary' | 'unhandledrejection';

let lastFingerprint = '';
let lastAt = 0;
const DEDUP_MS = 10_000;

function fingerprint(message: string, kind: ReportKind): string {
  return `${kind}:${message.slice(0, 120)}`;
}

/**
 * Отправка короткого лога на сервер (сервер пишет в БД только если включено в админке).
 * Вызывать только из браузера.
 */
export function reportClientError(payload: {
  message: string;
  stack?: string;
  href?: string;
  componentStack?: string;
  kind?: ReportKind;
}): void {
  if (typeof window === 'undefined') return;
  const message = payload.message?.trim();
  if (!message) return;

  const kind = payload.kind ?? 'runtime';
  const fp = fingerprint(message, kind);
  const now = Date.now();
  if (fp === lastFingerprint && now - lastAt < DEDUP_MS) return;
  lastFingerprint = fp;
  lastAt = now;

  const body = JSON.stringify({
    message: message.slice(0, 500),
    stack: payload.stack?.slice(0, 8000),
    href: payload.href ?? `${window.location.pathname}${window.location.search}`.slice(0, 2000),
    componentStack: payload.componentStack?.slice(0, 4000),
    kind,
  });

  try {
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
