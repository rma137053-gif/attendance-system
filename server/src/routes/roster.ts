import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requireStoreAdmin } from '../middleware/requireStoreAdmin';
import { audit } from '../middleware/audit';
import * as rosterService from '../services/roster.service';

const router = Router();
router.use(authMiddleware);

// Get today's roster for current user — any authenticated user
router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await rosterService.getTodayRoster(req.user!.userId, req.user!.storeId, req.user!.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Query roster — any authenticated user (scoped by store)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId, startDate, endDate, userId } = req.query;
    const result = await rosterService.queryRoster(
      {
        storeId: storeId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        userId: userId as string | undefined,
        requesterUserId: req.user!.userId,
        requesterRole: req.user!.role,
      },
      req.user!.storeId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Batch upsert — STORE_ADMIN+
const batchSchema = z.object({
  storeId: z.string().min(1, '门店ID不能为空'),
  assignments: z
    .array(
      z.object({
        userId: z.string().min(1, '员工ID不能为空'),
        shiftDate: z.string().min(1, '排班日期不能为空'),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, '开始时间格式错误（HH:mm）'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, '结束时间格式错误（HH:mm）'),
        breakMinutes: z.number().int().min(0).optional(),
      }),
    )
    .min(1, '排班数据不能为空'),
});

router.post(
  '/batch',
  requireStoreAdmin,
  audit('BATCH_UPSE_ROSTER', 'Roster'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = batchSchema.parse(req.body);
      const result = await rosterService.batchUpsertRoster(body.storeId, body.assignments, req.user!.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Delete — STORE_ADMIN+
router.delete(
  '/:id',
  requireStoreAdmin,
  audit('DELETE_ROSTER', 'Roster'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rosterService.deleteRoster(req.params.id as string, req.user!.storeId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Get recent roster notifications for the current user
router.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const since = req.query.since as string | undefined;
    const result = await rosterService.getRecentNotifications(
      req.user!.userId,
      req.user!.storeId,
      since,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
