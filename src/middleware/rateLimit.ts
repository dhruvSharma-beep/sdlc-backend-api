import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Sliding-window config per route prefix (requests / window in ms)
const RULES: Array<{ prefix: string; max: number; windowMs: number }> = [
  { prefix: '/api/auth',              max: 10,  windowMs: 60_000 },
  { prefix: '/api/ai/',               max: 20,  windowMs: 60_000 },
  { prefix: '/api/github/pulls/analyze', max: 15, windowMs: 60_000 },
  { prefix: '/api/releases/smart-create', max: 5, windowMs: 60_000 },
  { prefix: '/api',                   max: 100, windowMs: 60_000 },
];

function getRule(pathname: string) {
  return RULES.find(r => pathname.startsWith(r.prefix)) ?? RULES[RULES.length - 1];
}

let redis: any = null;

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    const { Redis } = await import('ioredis');
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, retryStrategy: (t: number) => t > 3 ? null : t * 250 });
    redis.on('error', (e: Error) => console.error('[redis]', e.message));
  }
  return redis;
}

export async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const r = await getRedis();
  if (!r) return null; // fail open — no Redis configured

  const ip   = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  const path = new URL(req.url).pathname;
  const rule = getRule(path);
  const key  = `rl:${path}:${ip}`;
  const now  = Date.now();
  const min  = now - rule.windowMs;

  try {
    const pipe = r.pipeline();
    pipe.zremrangebyscore(key, '-inf', min);
    pipe.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
    pipe.zcard(key);
    pipe.pexpire(key, rule.windowMs);
    const results = await pipe.exec();
    const count   = (results?.[2]?.[1] ?? 0) as number;

    if (count > rule.max) {
      const retryAfter = Math.ceil(rule.windowMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Limit': String(rule.max), 'X-RateLimit-Remaining': '0' } }
      );
    }
  } catch (e: any) {
    // Redis error — fail open, log and continue
    console.error('[rate-limit] redis error, failing open:', e.message);
  }

  return null;
}