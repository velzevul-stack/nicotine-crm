import { getDataSource } from '@/lib/db/data-source';
import { ClientErrorLogEntity } from '@/lib/db/entities';
import { getClientErrorLoggingEnabled } from '@/lib/system-settings';
import { ValidationError } from '@/services/common/domain-errors';
import { clientErrorBodySchema } from '@/services/client-errors/client-errors.validators';

function truncate(s: string | undefined, max: number): string | null {
  if (s == null || s === '') return null;
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export type LogClientErrorInput = {
  body: unknown;
  session: { shopId: string; userId: string } | null;
  userAgent: string | null;
};

/** Возвращает `logged: false` если логирование выключено или событие отфильтровано как шум. */
export async function logClientErrorIfEnabled(input: LogClientErrorInput): Promise<{ logged: boolean }> {
  const parsed = clientErrorBodySchema.safeParse(input.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const enabled = await getClientErrorLoggingEnabled();
  if (!enabled) {
    return { logged: false };
  }

  const noise =
    parsed.data.message.includes('ResizeObserver') ||
    parsed.data.message.includes('Loading chunk') ||
    parsed.data.message.includes('Failed to fetch dynamically imported module');
  if (noise) {
    return { logged: false };
  }

  const stackCombined = [parsed.data.stack, parsed.data.componentStack].filter(Boolean).join('\n---\n');

  const ds = await getDataSource();
  const row = ds.getRepository(ClientErrorLogEntity).create({
    shopId: input.session?.shopId ?? null,
    userId: input.session?.userId ?? null,
    kind: parsed.data.kind ?? 'runtime',
    message: parsed.data.message.trim(),
    stack: truncate(stackCombined, 12000),
    href: truncate(parsed.data.href, 2000),
    userAgent: truncate(input.userAgent ?? undefined, 512),
  });
  await ds.getRepository(ClientErrorLogEntity).save(row);

  return { logged: true };
}
