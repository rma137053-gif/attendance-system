import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
const prisma = new PrismaClient();

// All routes require ADMIN
router.use(authMiddleware, requireAdmin);

// GET /api/stores — list all stores with their manager info
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await prisma.store.findMany({
      include: {
        users: {
          where: { role: 'STORE_ADMIN' },
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = stores.map((s) => ({
      id: s.id,
      name: s.name,
      manager: s.users[0] || null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/stores/:id/manager — update store manager email and/or password
const updateManagerSchema = z.object({
  email: z.string().email('邮箱格式不正确').optional(),
  password: z.string().min(1, '密码不能为空').optional(),
});

router.put('/:id/manager', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = updateManagerSchema.parse(req.body);

    if (!body.email && !body.password) {
      res.status(400).json({ error: '请提供邮箱或密码' });
      return;
    }

    // Find the store's STORE_ADMIN user
    const manager = await prisma.user.findFirst({
      where: { storeId: id, role: 'STORE_ADMIN' },
    });

    if (!manager) {
      res.status(404).json({ error: '该门店没有店长账号' });
      return;
    }

    const data: Record<string, string> = {};
    if (body.email) data.email = body.email;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

    const updated = await prisma.user.update({
      where: { id: manager.id },
      data,
      select: { id: true, email: true, name: true },
    });

    res.json({ success: true, manager: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
