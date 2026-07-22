import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requireStoreAdmin } from '../middleware/requireStoreAdmin';
import * as announcementService from '../services/announcement.service';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  type: z.enum(['GENERAL', 'ROSTER', 'HOLIDAY']).optional(),
  storeId: z.string().optional(),
});

// Create announcement (STORE_ADMIN+)
router.post('/', requireStoreAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const announcement = await announcementService.createAnnouncement({
      ...body,
      createdBy: req.user!.userId,
      requesterStoreId: req.user!.storeId,
    });
    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
});

// List announcements (scoped by store)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId, page, pageSize } = req.query;
    const result = await announcementService.queryAnnouncements(
      {
        storeId: storeId as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      },
      req.user!.storeId,
      req.user!.role,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  type: z.enum(['GENERAL', 'ROSTER', 'HOLIDAY']).optional(),
});

// Update announcement
router.put('/:id', requireStoreAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const announcement = await announcementService.updateAnnouncement(
      req.params.id as string,
      body,
      req.user!.storeId,
    );
    res.json(announcement);
  } catch (err) {
    next(err);
  }
});

// Delete announcement
router.delete('/:id', requireStoreAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await announcementService.deleteAnnouncement(req.params.id as string, req.user!.storeId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
