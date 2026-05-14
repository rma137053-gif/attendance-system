import { Router, Request, Response, NextFunction } from 'express';
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
    const rows = await reportService.getMonthlyReport(getStoreId(req), req.query.month as string | undefined);
    const summary = reportService.generateSummary(rows);
    res.json({ rows, summary });
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
      rows = await reportService.getMonthlyReport(storeId, req.query.month as string | undefined);
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
