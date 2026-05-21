/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import { GET as healthGET } from '../../app/api/health/route';
import { middleware } from '../../middleware';

function req(method: string, pathname: string, ip?: string) {
  const url = `http://localhost${pathname}`;
  const headers: Record<string, string> = {};
  if (ip) headers['x-forwarded-for'] = ip;
  return new NextRequest(url, { method, headers });
}

describe('GET /api/health', () => {
  it('returns 200 with status ok and a numeric ts', async () => {
    const res = healthGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; ts: number };
    expect(body.status).toBe('ok');
    expect(typeof body.ts).toBe('number');
  });
});

describe('middleware', () => {
  it('attaches x-request-id to every response', async () => {
    const res = await middleware(req('GET', '/api/health'));
    expect(res.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('allows POST /api/orders within the rate limit', async () => {
    const res = await middleware(req('POST', '/api/orders', '1.2.3.4'));
    expect(res.status).not.toBe(429);
  });

  it('returns 429 after exceeding the rate limit', async () => {
    const ip = `test-${Date.now()}`; // unique IP so previous tests don't interfere
    for (let i = 0; i < 10; i++) {
      await middleware(req('POST', '/api/orders', ip));
    }
    const res = await middleware(req('POST', '/api/orders', ip));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/too many requests/i);
  });

  it('sets Retry-After based on remaining window time, not the full window', async () => {
    const ip = `retry-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      await middleware(req('POST', '/api/orders', ip));
    }
    const before = Date.now();
    const res = await middleware(req('POST', '/api/orders', ip));
    const retryAfter = Number(res.headers.get('Retry-After'));
    const maxExpected = Math.ceil((60_000 - (Date.now() - before)) / 1000) + 1;
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(retryAfter).toBeLessThanOrEqual(maxExpected);
  });

  it('does not rate-limit GET requests', async () => {
    const ip = `get-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      const res = await middleware(req('GET', '/api/orders', ip));
      expect(res.status).not.toBe(429);
    }
  });
});
