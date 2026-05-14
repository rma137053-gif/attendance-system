import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as recordService from '../services/record.service';

const router = Router();
router.use(authMiddleware);

router.get('/:recordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buffer = await recordService.getPhotoForRecord(
      req.params.recordId as string,
      req.user!.userId,
      req.user!.role,
      req.user!.storeId,
    );
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
