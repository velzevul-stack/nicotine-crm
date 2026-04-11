import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { ClientErrorLogEntity } from '@/lib/db/entities';
import { getClientErrorLoggingEnabled } from '@/lib/system-settings';

const bodySchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(8000).optional(),
  href: z.string().max(2000).optional(),
  componentStack: z.string().max(4000).optional(),
  kind: z.enum(['runtime', 'boundary', 'unhandledrejection']).optional(),
});

function truncate(s: string | undefined, max: number): string | null {
  if (s == null || s === '') return null;
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Публичный endpoint: пишет только если включено в system_settings (админка). */
export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
  }

  const enabled = await getClientErrorLoggingEnabled();
  if (!enabled) {
    return new NextResponse(null, { status: 204 });
  }

  const noise =
    parsed.data.message.includes('ResizeObserver') ||
    parsed.data.message.includes('Loading chunk') ||
    parsed.data.message.includes('Failed to fetch dynamically imported module');
  if (noise) {
    return new NextResponse(null, { status: 204 });
  }

  const session = await getSession();
  const ua = request.headers.get('user-agent');
  const stackCombined = [parsed.data.stack, parsed.data.componentStack].filter(Boolean).join('\n---\n');

  const ds = await getDataSource();
  const row = ds.getRepository(ClientErrorLogEntity).create({
    shopId: session?.shopId ?? null,
    userId: session?.userId ?? null,
    kind: parsed.data.kind ?? 'runtime',
    message: parsed.data.message.trim(),
    stack: truncate(stackCombined, 12000),
    href: truncate(parsed.data.href, 2000),
    userAgent: truncate(ua ?? undefined, 512),
  });
  await ds.getRepository(ClientErrorLogEntity).save(row);

  return new NextResponse(null, { status: 204 });
}
