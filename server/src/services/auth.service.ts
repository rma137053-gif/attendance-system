import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const prisma = new PrismaClient();

export async function register(email: string, password: string, name: string, storeId: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new BadRequestError('该邮箱已被注册');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: 'EMPLOYEE', storeId },
    select: { id: true, email: true, name: true, role: true, storeId: true },
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { store: { select: { id: true, name: true } } },
  });
  if (!user) {
    throw new UnauthorizedError('邮箱或密码错误');
  }
  if (user.status === 'INACTIVE') {
    throw new UnauthorizedError('账号已被停用');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('邮箱或密码错误');
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, storeId: user.storeId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      storeId: user.storeId,
      storeName: user.store?.name ?? null,
    },
  };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError();

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new BadRequestError('当前密码不正确');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, status: true, storeId: true, store: { select: { id: true, name: true } } },
  });
  if (!user) throw new UnauthorizedError();
  return user;
}
