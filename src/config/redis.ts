// Redis Client — SDLC-5
let redis: any = null;

export function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    const { Redis } = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: (t: number) => t > 3 ? null : t * 200,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redis.on('error', (e: Error) => console.error('Redis error:', e.message));
  }
  return redis;
}
