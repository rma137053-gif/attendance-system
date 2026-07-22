import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import * as overtimeService from '../services/overtime.service';

const router = Router();

// All overtime routes require auth + admin
router.use(authMiddleware);

const createSchema = z.object({
  userId: z.string().min(1, '员工ID不能为空'),
  storeId: z.string().min(1, '门店ID不能为空'),
  date: z.string().min(1, '日期不能为空'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '开始时间格式无效'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '结束时间格式无效'),
  type: z.enum(['VOLUNTARY', 'COVERAGE']).optional(),
  coveredUserId: z.string().optional(),
  reason: z.string().optional(),
});

const updateSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '开始时间格式无效').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '结束时间格式无效').optional(),
  reason: z.string().optional(),
});

// GET /api/overtime
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await overtimeService.listOvertime({
      storeId: (req.query.storeId as string) || undefined,
      startDate: (req.query.startDate as string) || undefined,
      endDate: (req.query.endDate as string) || undefined,
      userId: (req.query.userId as string) || undefined,
      type: (req.query.type as string) || undefined,
      requesterStoreId: req.user!.storeId,
      requesterRole: req.user!.role,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/overtime — admin only
router.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const record = await overtimeService.createOvertime(body, req.user!.storeId, req.user!.role);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// PUT /api/overtime/:id — admin only
router.put('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const record = await overtimeService.updateOvertime(req.params.id as string, body, req.user!.role);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/overtime/:id — admin only
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await overtimeService.deleteOvertime(req.params.id as string, req.user!.role);
    res.json({ message: '已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
