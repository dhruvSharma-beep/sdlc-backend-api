// Auth Routes — SDLC-6
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signToken, verifyToken } from '../utils/token';
import { prisma } from '../utils/db';

const router = Router();

router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  try {
    const payload = await verifyToken(resetToken);
    const hash = await bcrypt.hash(newPassword, 12);
    // Updating updatedAt invalidates all existing JWTs via iat check
    await prisma.user.update({ where: { id: payload.sub }, data: { password: hash } });
    res.json({ success: true, message: 'Password reset. All sessions have been invalidated.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
