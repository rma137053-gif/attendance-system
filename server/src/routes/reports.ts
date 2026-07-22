import { Router, Request, Response, NextFunction } from 'express';
import dayjs from 'dayjs';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import * as reportService from '../services/report.service';

const router = Router();
router.use(authMiddleware, requireAdmin);

function getStoreId(req: Request): string | null {
  // Global admin can filter by store; store-scoped admin uses their own storeId
  if (!req.user!.storeId) {
    return (req.query.storeId as string) || null;
  }
  return req.user!.storeId;
}

router.get('/weekly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await reportService.getWeeklyReport(getStoreId(req), req.query.date as string | undefined);
    const summary = reportService.generateSummary(rows);
    res.json({ rows, summary });
  } catch (err) {
    next(err);
  }
});

router.get('/monthly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.getMonthlyReport(getStoreId(req), req.query.month as string | undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 员工每日明细（用于工时统计展开查看）
router.get('/user-daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string;
    const month = (req.query.month as string) || dayjs().tz('Asia/Shanghai').format('YYYY-MM');
    if (!userId) { res.status(400).json({ error: 'userId 不能为空' }); return; }
    const detail = await reportService.getUserDailyDetail(userId, month);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

router.get('/yearly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await reportService.getYearlyReport(getStoreId(req), req.query.year as string | undefined);
    const summary = reportService.generateSummary(rows);
    res.json({ rows, summary });
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type as string;
    const storeId = getStoreId(req);
    let rows;
    let filename: string;

    if (type === 'weekly') {
      rows = await reportService.getWeeklyReport(storeId, req.query.date as string | undefined);
      filename = `周报_${rows[0]?.weekStart?.slice(0, 10) || 'export'}.csv`;
    } else if (type === 'monthly') {
      const res = await reportService.getMonthlyReport(storeId, req.query.month as string | undefined);
      rows = res.rows;
      filename = `月报_${rows[0]?.month || 'export'}.csv`;
    } else if (type === 'yearly') {
      rows = await reportService.getYearlyReport(storeId, req.query.year as string | undefined);
      filename = `年报_${rows[0]?.year || 'export'}.csv`;
    } else {
      res.status(400).json({ error: 'type 参数必须为 weekly、monthly 或 yearly' });
      return;
    }

    const csv = reportService.generateCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send('﻿' + csv);
  } catch (err) {
    next(err);
  }
});

export default router;
