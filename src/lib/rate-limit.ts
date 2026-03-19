/**
 * In-memory rate limiter for auth endpoints.
 * Limits: 10 requests per minute per IP.
 * Note: For multi-instance deployments (e.g. Vercel serverless), consider @upstash/ratelimit.
 */

import { NextResponse } from 'next/server';

const AUTH_LIMIT = 10;
const AUTH_WINDOW_MS = 60 * 1000; // 1 minute

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const authAttempts = new Map<string, RateLimitEntry>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of authAttempts.entries()) {
    if (entry.resetAt < now) {
      authAttempts.delete(key);
    }
  }
}

/**
 * Checks rate limit for auth endpoints. Returns null if allowed, or NextResponse with 429 if over limit.
 */
export function checkAuthRateLimit(request: Request): NextResponse | null {
  const ip = getClientIp(request);
  const now = Date.now();

  cleanupExpired();

  let entry = authAttempts.get(ip);
  if (!entry) {
    entry = { count: 1, resetAt: now + AUTH_WINDOW_MS };
    authAttempts.set(ip, entry);
    return null;
  }

  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + AUTH_WINDOW_MS };
    authAttempts.set(ip, entry);
    return null;
  }

  entry.count += 1;
  if (entry.count > AUTH_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  return null;
}
