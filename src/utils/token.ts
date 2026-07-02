// JWT Utilities — SDLC-6: add passwordChangedAt invalidation
import jwt from 'jsonwebtoken';
import { prisma } from './db';

const SECRET = process.env.JWT_SECRET!;

export function signToken(userId: string, email: string, role: string) {
  return jwt.sign({ sub: userId, email, role }, SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string) {
  const payload = jwt.verify(token, SECRET) as any;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { updatedAt: true, isActive: true },
  });

  if (!user || !user.isActive) throw new Error('User not found or inactive');

  // Reject tokens issued before the last password change
  const changedAt = Math.floor(user.updatedAt.getTime() / 1000);
  if (payload.iat < changedAt) {
    throw new Error('Session expired after password change — please log in again');
  }

  return payload;
}
