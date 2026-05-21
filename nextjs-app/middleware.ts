import { NextRequest, NextResponse } from 'next/server';

// In-memory sliding-window rate limiter (per IP, resets every WINDOW_MS).
// Edge runtime keeps this map alive across requests within the same isolate.
const RATE_LIMIT = 10; // max POST /api/orders per window
const WINDOW_MS = 60_000; // 1 minute

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = windows.get(ip);

  if (!entry || now >= entry.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;

  entry.count++;
  return false;
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

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before placing another order.' },
        {
          status: 429,
          headers: {
            'x-request-id': requestId,
            'Retry-After': String(Math.ceil(WINDOW_MS / 1000)),
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
