import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireStoreAdmin } from '../middleware/requireStoreAdmin';
import * as statsService from '../services/stats.service';

const router = Router();
router.use(authMiddleware, requireStoreAdmin);

router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Global admin can filter by store; store-scoped admin uses their own storeId
    const storeId = req.user!.storeId || (req.query.storeId as string) || null;
    const stats = await statsService.getTodayStats(storeId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
