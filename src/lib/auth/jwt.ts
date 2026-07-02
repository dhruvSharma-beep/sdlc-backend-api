import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';

const SECRET = process.env.JWT_SECRET!;
if (!SECRET) throw new Error('JWT_SECRET env var is required');

export interface JWTPayload { sub: string; email: string; role: string; iat: number; exp: number; }

export function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ sub: userId, email, role }, SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  // 1. Standard JWT verification (signature + expiry)
  const payload = jwt.verify(token, SECRET) as JWTPayload;

  // 2. Lookup user — confirm still active
  const user = await prisma.user.findUnique({
    where:  { id: payload.sub },
    select: { updatedAt: true, isActive: true },
  });

  if (!user)            throw new Error('User not found');
  if (!user.isActive)   throw new Error('Account deactivated');

  // 3. Invalidate tokens issued before last password change
  //    updatedAt is bumped on every user.update(), including password resets.
  //    Tokens older than updatedAt were issued under a previous password.
  const changedAt = Math.floor(user.updatedAt.getTime() / 1000);
  if (payload.iat < changedAt) {
    throw new Error('Session expired — your password was recently changed. Please log in again.');
  }

  return payload;
}