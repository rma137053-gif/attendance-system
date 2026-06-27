import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requireStoreAdmin } from '../middleware/requireStoreAdmin';
import { requireAdmin } from '../middleware/requireAdmin';
import * as recordService from '../services/record.service';
import { BadRequestError } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    // Accept all images; also accept application/octet-stream as mobile browsers
    // may send camera captures without a proper MIME type
    const mime = file.mimetype || '';
    if (mime.startsWith('image/') || mime === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new BadRequestError('仅支持图片文件'));
    }
  },
});

function resolveClockUserId(req: Request): string {
  const role = req.user!.role;
  const bodyUserId = req.body.userId as string | undefined;

  // ADMIN or STORE_ADMIN can clock on behalf of an employee
  if ((role === 'ADMIN' || role === 'STORE_ADMIN') && bodyUserId) {
    return bodyUserId;
  }
  return req.user!.userId;
}

// Accept either multipart file upload or JSON with base64 photo
router.post(
  '/clock-in',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let photoBuffer: Buffer | undefined;
      let photoOriginalName: string | undefined;

      if (req.file) {
        // Multipart upload
        photoBuffer = req.file.buffer;
        photoOriginalName = req.file.originalname;
      } else if (req.body.photoBase64) {
        // JSON base64 upload (mobile-friendly)
        const base64 = req.body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        photoBuffer = Buffer.from(base64, 'base64');
        photoOriginalName = req.body.photoName || 'photo.jpg';
      }

      const clockUserId = resolveClockUserId(req);
      const record = await recordService.createRecord({
        userId: clockUserId,
        type: 'CLOCK_IN',
        photoBuffer,
        photoOriginalName,
        requesterStoreId: clockUserId !== req.user!.userId ? req.user!.storeId : undefined,
      });
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/clock-out',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let photoBuffer: Buffer | undefined;
      let photoOriginalName: string | undefined;

      if (req.file) {
        photoBuffer = req.file.buffer;
        photoOriginalName = req.file.originalname;
      } else if (req.body.photoBase64) {
        const base64 = req.body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        photoBuffer = Buffer.from(base64, 'base64');
        photoOriginalName = req.body.photoName || 'photo.jpg';
      }

      const clockUserId = resolveClockUserId(req);
      const record = await recordService.createRecord({
        userId: clockUserId,
        type: 'CLOCK_OUT',
        photoBuffer,
        photoOriginalName,
        requesterStoreId: clockUserId !== req.user!.userId ? req.user!.storeId : undefined,
      });
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  },
);

// STORE_ADMIN+ can view records
router.get('/', requireStoreAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isGlobalAdmin = req.user!.role === 'ADMIN' && !req.user!.storeId;
    const { userId, startDate, endDate, type, page, pageSize, storeId, anomalous } = req.query;

    const filterUserId = userId as string | undefined;

    const effectiveStoreId = isGlobalAdmin
      ? (storeId as string | undefined) || null
      : req.user!.storeId;

    const result = await recordService.queryRecords(
      {
        userId: filterUserId,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        type: type as 'CLOCK_IN' | 'CLOCK_OUT' | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        anomalous: anomalous === 'true' ? true : anomalous === 'false' ? false : undefined,
      },
      effectiveStoreId,
      req.user!.role,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ADMIN only: toggle anomaly status of a record
router.patch('/:id/anomaly', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await recordService.toggleAnomaly(req.params.id as string, req.user!.storeId);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

// ADMIN only: manually create a clock record (补录打卡)
const manualSchema = z.object({
  userId: z.string().min(1, '员工不能为空'),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT'], { message: '类型无效' }),
  timestamp: z.string().min(1, '时间不能为空'),
  note: z.string().optional(),
});

router.post('/manual', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = manualSchema.parse(req.body);
    const record = await recordService.createManualRecord({
      ...body,
      requesterStoreId: req.user!.storeId,
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// ADMIN only: update an existing clock record (编辑打卡)
const updateSchema = z.object({
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT']).optional(),
  timestamp: z.string().optional(),
  note: z.string().optional(),
});

router.put('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const record = await recordService.updateRecord({
      recordId: req.params.id as string,
      ...body,
      requesterStoreId: req.user!.storeId,
    });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

export default router;
