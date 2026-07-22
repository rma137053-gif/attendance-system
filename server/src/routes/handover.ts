import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { audit } from '../middleware/audit';
import * as handoverService from '../services/handover.service';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  rosterId: z.string().min(1, '排班ID不能为空'),
  content: z.string().min(1, '备注内容不能为空').max(500, '备注内容不能超过500字'),
});

// Create handover note
router.post(
  '/',
  audit('CREATE_HANDOVER', 'HandoverNote'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSchema.parse(req.body);
      const note = await handoverService.createHandoverNote(
        body.rosterId,
        req.user!.userId,
        body.content,
        req.user!.storeId,
      );
      res.status(201).json(note);
    } catch (err) {
      next(err);
    }
  },
);

// List handover notes for a roster
router.get('/:rosterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = await handoverService.listHandoverNotes(req.params.rosterId as string, req.user!.storeId);
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

export default router;
