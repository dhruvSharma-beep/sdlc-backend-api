import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { verifyToken, signToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const { resetToken, newPassword } = await req.json();
    if (!resetToken || !newPassword) return NextResponse.json({ error: 'resetToken and newPassword required' }, { status: 400 });
    if (newPassword.length < 10)     return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });

    // Reset tokens are short-lived JWTs with purpose claim — verify first
    const payload = await verifyToken(resetToken);
    const hash    = await bcrypt.hash(newPassword, 12);

    // Updating the record bumps updatedAt, which invalidates all existing JWTs
    const user = await prisma.user.update({ where: { id: payload.sub }, data: { password: hash } });

    // Issue a fresh session token for the user
    const sessionToken = signToken(user.id, user.email, (user as any).role);
    return NextResponse.json({ success: true, token: sessionToken, message: 'Password updated. All other sessions have been invalidated.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}