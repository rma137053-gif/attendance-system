import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();
const router = Router();

function auth(req: Request): { userId: string; username: string; role: string } {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new UnauthorizedError();
  try {
    return jwt.verify(auth.slice(7), config.jwtSecret) as any;
  } catch {
    throw new UnauthorizedError('Token 无效');
  }
}

function requireAdmin(req: Request) {
  const user = auth(req);
  if (user.role !== 'ADMIN') throw new ForbiddenError('仅管理员可操作');
  return user;
}

function requireAuth(req: Request) {
  const user = auth(req);
  if (user.role !== 'ADMIN' && user.role !== 'ACCOUNTANT') throw new ForbiddenError('无权限');
  return user;
}

// 获取库存总量和月度统计
router.get('/summary', async (req: Request, res: Response) => {
  requireAuth(req);

  const allTx = await prisma.tagTransaction.findMany({
    select: { type: true, quantity: true, createdAt: true },
  });

  let totalIn = 0, totalOut = 0, totalLoss = 0, totalReturn = 0;
  let monthIn = 0, monthOut = 0, monthLoss = 0, monthReturn = 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const t of allTx) {
    if (t.type === 'IN' || t.type === 'RETURN') {
      totalIn += t.quantity;
      if (t.createdAt >= monthStart) monthIn += t.quantity;
    } else if (t.type === 'OUT') {
      totalOut += t.quantity;
      if (t.createdAt >= monthStart) monthOut += t.quantity;
    } else if (t.type === 'RETURN') {
      totalReturn += t.quantity;
      if (t.createdAt >= monthStart) monthReturn += t.quantity;
    } else if (t.type === 'LOSS') {
      totalLoss += t.quantity;
      if (t.createdAt >= monthStart) monthLoss += t.quantity;
    }
  }

  const recent = await prisma.tagTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({
    totalStock: totalIn + totalReturn - totalOut - totalLoss,
    totalIn, totalOut, totalLoss, totalReturn,
    monthIn, monthOut, monthLoss, monthReturn,
    recent,
  });
});

// 获取交易列表
router.get('/', async (req: Request, res: Response) => {
  requireAuth(req);
  const { type, page = '1', pageSize = '20' } = req.query;
  const where: any = {};
  if (type) where.type = type;

  const [items, total] = await Promise.all([
    prisma.tagTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.tagTransaction.count({ where }),
  ]);

  res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
});

// 入库（仅管理员）
router.post('/in', async (req: Request, res: Response) => {
  const user = requireAdmin(req);
  const { quantity, note } = req.body;
  if (!quantity || quantity <= 0) throw new BadRequestError('数量必须大于0');

  const tx = await prisma.tagTransaction.create({
    data: { type: 'IN', quantity, note: note || null, createdBy: user.username },
  });
  res.status(201).json(tx);
});

// 每日使用（管理员+会计）
router.post('/out', async (req: Request, res: Response) => {
  const user = requireAuth(req);
  const { quantity, employeeName, date, note } = req.body;
  if (!quantity || quantity <= 0) throw new BadRequestError('数量必须大于0');
  if (!employeeName) throw new BadRequestError('请填写员工姓名');

  const tx = await prisma.tagTransaction.create({
    data: { type: 'OUT', quantity, employeeName, recordDate: date ? new Date(date) : null, note: note || null, createdBy: user.username },
  });
  res.status(201).json(tx);
});

// 退回（管理员+会计）
router.post('/return', async (req: Request, res: Response) => {
  const user = requireAuth(req);
  const { quantity, employeeName, note } = req.body;
  if (!quantity || quantity <= 0) throw new BadRequestError('数量必须大于0');

  const tx = await prisma.tagTransaction.create({
    data: { type: 'RETURN', quantity, employeeName: employeeName || null, note: note || null, createdBy: user.username },
  });
  res.status(201).json(tx);
});

// 报损（管理员+会计）
router.post('/loss', async (req: Request, res: Response) => {
  const user = requireAuth(req);
  const { quantity, note } = req.body;
  if (!quantity || quantity <= 0) throw new BadRequestError('数量必须大于0');

  const tx = await prisma.tagTransaction.create({
    data: { type: 'LOSS', quantity, note: note || null, createdBy: user.username },
  });
  res.status(201).json(tx);
});

// 删除记录（仅管理员）
router.delete('/:id', async (req: Request, res: Response) => {
  const user = requireAdmin(req);
  const id = req.params.id as string;
  const tx = await prisma.tagTransaction.findUnique({ where: { id } });
  if (!tx) throw new NotFoundError('记录不存在');
  await prisma.tagTransaction.delete({ where: { id } });
  res.json({ message: '已删除' });
});

export default router;
