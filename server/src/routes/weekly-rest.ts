import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { ForbiddenError } from '../utils/errors';
import * as weeklyRestService from '../services/weekly-rest.service';

const router = Router();
router.use(authMiddleware);

// 查询休息日列表 — EMPLOYEE 只看自己，STORE_ADMIN 看本店，ADMIN 看全部
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, userId, storeId } = req.user!;

    const items = await weeklyRestService.listRestDays(
      {
        storeId: req.query.storeId as string | undefined,
        userId: req.query.userId as string | undefined,
        weekStart: req.query.weekStart as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      },
      { userId, role, storeId },
    );
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// 选休/指定休息日 — EMPLOYEE 给自己选，ADMIN/STORE_ADMIN 给任意员工指定
const upsertSchema = z.object({
  userId: z.string().optional(),
  restDate: z.string().min(1, '休息日期不能为空'),
  weekStart: z.string().optional(),
});

router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, userId: currentUserId, storeId } = req.user!;
    const body = upsertSchema.parse(req.body);

    let targetUserId: string;
    let targetStoreId: string;

    if (role === 'EMPLOYEE') {
      targetUserId = currentUserId;
      targetStoreId = storeId!;
    } else {
      if (!body.userId) throw new ForbiddenError('请选择员工');
      targetUserId = body.userId;
      targetStoreId = (req.body as any).storeId || storeId || '';
    }

    const result = await weeklyRestService.upsertRestDay(
      targetUserId,
      targetStoreId,
      body.restDate,
      { userId: currentUserId, role, storeId },
      body.weekStart,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 删除休息日
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await weeklyRestService.deleteRestDay(req.params.id as string, {
      userId: req.user!.userId,
      role: req.user!.role,
      storeId: req.user!.storeId,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 获取某门店某周休息日 Map（排班助手用）
router.get('/store-week', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, storeId } = req.user!;
    if (role === 'EMPLOYEE') throw new ForbiddenError();

    let targetStoreId = (req.query.storeId as string) || storeId || '';
    if (!targetStoreId) throw new ForbiddenError('请指定门店');

    const weekStart = req.query.weekStart as string;
    if (!weekStart) throw new ForbiddenError('请指定周起始日期');

    const map = await weeklyRestService.getRestMapForStore(targetStoreId, weekStart);
    res.json({ restMap: map });
  } catch (err) {
    next(err);
  }
});

export default router;
