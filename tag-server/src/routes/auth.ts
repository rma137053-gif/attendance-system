import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const prisma = new PrismaClient();
const router = Router();

// 登录
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) throw new BadRequestError('用户名和密码不能为空');

  const user = await prisma.tagUser.findUnique({ where: { username } });
  if (!user) throw new UnauthorizedError('用户名或密码错误');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('用户名或密码错误');

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' },
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// 获取当前用户信息
router.get('/me', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new UnauthorizedError();

  try {
    const payload = jwt.verify(auth.slice(7), config.jwtSecret) as any;
    const user = await prisma.tagUser.findUnique({ where: { id: payload.userId } });
    if (!user) throw new UnauthorizedError();
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch {
    throw new UnauthorizedError('Token 无效');
  }
});

export default router;
