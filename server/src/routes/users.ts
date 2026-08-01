import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireStoreAdmin } from '../middleware/requireStoreAdmin';
import * as userService from '../services/user.service';

const router = Router();

// Employee roster — STORE_ADMIN+ can access (scoped to their store)
router.get('/roster', authMiddleware, requireStoreAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.listEmployeeRoster(req.user!.storeId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// PIN verification — any authenticated user can verify an employee's PIN
const verifyPinSchema = z.object({
  userId: z.string().min(1, '员工ID不能为空'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN码必须为4-6位数字'),
});

router.post('/verify-pin', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = verifyPinSchema.parse(req.body);
    const result = await userService.verifyPin(body.userId, body.pin, req.user!.storeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// All routes below require at least STORE_ADMIN
router.use(authMiddleware, requireStoreAdmin);

// List stores — ADMIN only
router.get('/stores', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await userService.listStores();
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位'),
  name: z.string().min(1, '姓名不能为空'),
  storeId: z.string().optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN码必须为4-6位数字').optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const effectiveStoreId = req.user!.role === 'ADMIN' && req.query.storeId
      ? (req.query.storeId as string)
      : req.user!.storeId;
    const includeInactive = req.query.includeInactive === 'true';
    const users = await userService.listEmployees(effectiveStoreId, includeInactive);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    // STORE_ADMIN always creates in their own store; ADMIN can specify
    const storeId = req.user!.role === 'ADMIN' && body.storeId
      ? body.storeId
      : req.user!.storeId!;
    const user = await userService.createEmployee(body.email, body.password, body.name, storeId, body.pin);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// ADMIN-only routes
const updateSchema = z.object({
  name: z.string().min(1, '姓名不能为空').optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN码必须为4-6位数字').optional().or(z.literal('')),
  crossStore: z.boolean().optional(),
});

router.put('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const user = await userService.updateEmployee(req.params.id as string, body, req.user!.storeId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.toggleEmployeeStatus(req.params.id as string, req.user!.storeId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, '密码至少6位'),
});

router.put('/:id/password', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    await userService.resetPassword(req.params.id as string, body.password, req.user!.storeId);
    res.json({ message: '密码重置成功' });
  } catch (err) {
    next(err);
  }
});

export default router;
