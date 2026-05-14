import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export async function listStores() {
  return prisma.store.findMany({ orderBy: { name: 'asc' } });
}

export async function listEmployeeRoster(storeId: string | null) {
  const where: any = { status: 'ACTIVE' };
  if (storeId) where.storeId = storeId;
  return prisma.user.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listEmployees(storeId: string | null) {
  const where: any = { status: 'ACTIVE' };
  if (storeId) where.storeId = storeId;
  return prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, role: true, status: true, pin: true, createdAt: true, storeId: true, store: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createEmployee(email: string, password: string, name: string, storeId: string, pin?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new BadRequestError('该邮箱已被注册');
  }

  if (pin && !/^\d{4,6}$/.test(pin)) {
    throw new BadRequestError('PIN码必须为4-6位数字');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, passwordHash, name, role: 'EMPLOYEE', storeId, pin },
    select: { id: true, email: true, name: true, role: true, status: true, storeId: true, store: { select: { id: true, name: true } } },
  });
}

export async function verifyPin(userId: string, pin: string, storeId: string | null) {
  const where: any = { id: userId, role: 'EMPLOYEE', status: 'ACTIVE' };
  if (storeId) where.storeId = storeId;

  const user = await prisma.user.findFirst({ where, select: { id: true, pin: true, name: true } });
  if (!user) throw new NotFoundError('员工不存在');

  if (!user.pin) throw new BadRequestError('该员工未设置PIN码');

  if (user.pin !== pin) throw new BadRequestError('PIN码不正确');

  return { id: user.id, name: user.name };
}

export async function updateEmployee(id: string, data: { name?: string; email?: string; pin?: string }, storeId: string | null) {
  const where: any = { id };
  if (storeId) where.storeId = storeId;
  const user = await prisma.user.findFirst({ where });
  if (!user) throw new NotFoundError('员工不存在');

  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestError('该邮箱已被注册');
  }

  if (data.pin !== undefined && data.pin !== '' && !/^\d{4,6}$/.test(data.pin)) {
    throw new BadRequestError('PIN码必须为4-6位数字');
  }

  // Allow clearing PIN by passing empty string
  const updateData: any = { ...data };
  if (data.pin === '') updateData.pin = null;

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, status: true, pin: true, storeId: true, store: { select: { id: true, name: true } } },
  });
}

export async function toggleEmployeeStatus(id: string, storeId: string | null) {
  const where: any = { id, role: 'EMPLOYEE' };
  if (storeId) where.storeId = storeId;
  const user = await prisma.user.findFirst({ where });
  if (!user) throw new NotFoundError('员工不存在');

  const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return prisma.user.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, email: true, name: true, role: true, status: true, storeId: true, store: { select: { id: true, name: true } } },
  });
}

export async function resetPassword(id: string, newPassword: string, storeId: string | null) {
  const where: any = { id, role: 'EMPLOYEE' };
  if (storeId) where.storeId = storeId;
  const user = await prisma.user.findFirst({ where });
  if (!user) throw new NotFoundError('员工不存在');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}
