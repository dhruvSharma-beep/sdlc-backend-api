// Rate Limiting Middleware — SDLC-5
import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '../config/redis';

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth':                    { max: 10,  windowMs: 60000 },
  '/api/github/pulls/analyze':    { max: 20,  windowMs: 60000 },
  '/api/releases/smart-create':   { max: 5,   windowMs: 60000 },
  default:                        { max: 100, windowMs: 60000 },
};

export async function rateLimitMiddleware(req: NextRequest) {
  const redis = getRedisClient();
  if (!redis) return null; // fail open if Redis unavailable

  const ip   = req.headers.get('x-forwarded-for') ?? 'unknown';
  const path = new URL(req.url).pathname;
  const cfg  = Object.entries(LIMITS).find(([k]) => path.startsWith(k) && k !== 'default')?.[1] ?? LIMITS.default;
  const key  = `rl:${path}:${ip}`;
  const now  = Date.now();

  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, '-inf', now - cfg.windowMs);
  pipe.zadd(key, now, `${now}-${Math.random()}`);
  pipe.zcard(key);
  pipe.pexpire(key, cfg.windowMs);
  const results = await pipe.exec();
  const count = results?.[2]?.[1] as number ?? 0;

  if (count > cfg.max) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(cfg.windowMs / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }
  return null;
}
