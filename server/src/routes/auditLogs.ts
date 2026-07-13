import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { formatBeijing } from '../utils/timezone';

const prisma = new PrismaClient();
const router = Router();
router.use(authMiddleware, requireAdmin);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 30;
    const action = req.query.action as string | undefined;

    const where: any = {};
    if (action) where.action = { contains: action };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs: logs.map((l) => ({
        ...l,
        createdAt: formatBeijing(l.createdAt),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
