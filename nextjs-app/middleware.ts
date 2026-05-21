import { NextRequest, NextResponse } from 'next/server';

// In-memory fixed-window rate limiter (per IP, window resets WINDOW_MS after
// the first request in a window). Edge runtime keeps this map alive across
// requests within the same isolate.
//
// Trust note: IP is read from x-forwarded-for / x-real-ip. These are only
// reliable when your deployment sits behind a trusted reverse proxy (e.g.
// Vercel, nginx) that overwrites these headers. Without that, clients can
// spoof the IP to bypass the limit. For self-hosted setups, ensure the proxy
// strips / rewrites forwarded headers before they reach this middleware.
const RATE_LIMIT = 10; // max POST /api/orders per window
const WINDOW_MS = 60_000; // 1 minute
const MAX_ENTRIES = 10_000; // evict oldest when map grows beyond this

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

function isRateLimited(ip: string): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();

  // Evict expired entries to prevent unbounded map growth
  if (windows.size >= MAX_ENTRIES) {
    windows.forEach((entry, key) => {
      if (now >= entry.resetAt) windows.delete(key);
    });
  }

  const entry = windows.get(ip);

  if (!entry || now >= entry.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterMs: 0 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { limited: false, retryAfterMs: 0 };
}

export function middleware(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set('x-request-id', requestId);

  // Rate-limit POST /api/orders only
  if (req.method === 'POST' && req.nextUrl.pathname === '/api/orders') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'anonymous';

    const { limited, retryAfterMs } = isRateLimited(ip);
    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before placing another order.' },
        {
          status: 429,
          headers: {
            'x-request-id': requestId,
            'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
          },
        },
      );
    }
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
