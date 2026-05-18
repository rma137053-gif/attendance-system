import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { ForbiddenError } from '../utils/errors';
import { sendAppMessage } from '../services/wechat.service';
import * as leaveService from '../services/leave.service';

const prisma = new PrismaClient();
const router = Router();

const LEAVE_TYPE_CN: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
};

// 所有路由都需要登录
router.use(authMiddleware);

// 查询请假列表 — EMPLOYEE 只看自己，ADMIN 看全部
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, userId } = req.user!;

    if (role === 'STORE_ADMIN') throw new ForbiddenError();

    const filters: any = {
      status: req.query.status as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    };

    if (role === 'EMPLOYEE') {
      filters.userId = userId;
    } else {
      // ADMIN
      if (req.query.storeId) filters.storeId = req.query.storeId as string;
      if (req.query.userId) filters.userId = req.query.userId as string;
    }

    const result = await leaveService.listLeaves(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 发起请假 — EMPLOYEE 给自己，ADMIN 给任意员工
const createSchema = z.object({
  userId: z.string().optional(),
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL'], { errorMap: () => ({ message: '无效的请假类型' }) }),
  startDate: z.string().min(1, '开始日期不能为空'),
  endDate: z.string().min(1, '结束日期不能为空'),
  reason: z.string().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, userId: currentUserId, storeId } = req.user!;

    if (role === 'STORE_ADMIN') throw new ForbiddenError();

    const body = createSchema.parse(req.body);

    let targetUserId: string;
    let targetStoreId: string;

    if (role === 'EMPLOYEE') {
      targetUserId = currentUserId;
      targetStoreId = storeId!;
    } else {
      // ADMIN
      if (!body.userId) throw new ForbiddenError('请选择员工');
      targetUserId = body.userId;
      targetStoreId = (req.body as any).storeId || storeId || '';
    }

    const leave = await leaveService.createLeave(
      targetUserId, targetStoreId, body.type, body.startDate, body.endDate, body.reason,
    );

    // 异步通知所有绑定了企业微信的管理员
    const employeeName = (leave as any).user?.name || '员工';
    notifyAdmins(leave.id, employeeName, body.type, body.startDate, body.endDate, body.reason);

    res.status(201).json(leave);
  } catch (err) {
    next(err);
  }
});

// 修改请假 — EMPLOYEE 改自己的 PENDING，ADMIN 改任意
const updateSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().optional(),
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const leave = await leaveService.updateLeave(req.params.id as string, body, {
      userId: req.user!.userId,
      role: req.user!.role,
      storeId: req.user!.storeId,
    });
    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// 审批通过 — 仅 ADMIN
router.patch('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') throw new ForbiddenError();
    const leave = await leaveService.approveLeave(req.params.id as string, req.user!.userId);
    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// 审批拒绝 — 仅 ADMIN
router.patch('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') throw new ForbiddenError();
    const leave = await leaveService.rejectLeave(req.params.id as string, req.user!.userId);
    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// 删除请假 — 仅 ADMIN
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') throw new ForbiddenError();
    await leaveService.deleteLeave(req.params.id as string);
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

/** 向所有已绑定企业微信的管理员发送请假审批通知 */
async function notifyAdmins(
  leaveId: string, employeeName: string, type: string,
  startDate: string, endDate: string, reason?: string,
) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', wechatUserId: { not: null } },
      select: { wechatUserId: true },
    });

    if (admins.length === 0) return;

    const typeLabel = LEAVE_TYPE_CN[type] || type;
    const content = `【${typeLabel}】${employeeName}\n日期：${startDate} ~ ${endDate}\n原因：${reason || '无'}\n\n请及时审批`;

    for (const admin of admins) {
      sendAppMessage({
        touser: admin.wechatUserId!,
        title: '新的请假申请',
        content,
        url: 'http://47.102.223.195/admin/leaves',
      }).catch((err: any) => console.error('[WeChat] 请假通知发送失败:', err.message));
    }
  } catch (err: any) {
    console.error('[WeChat] 查询管理员失败:', err.message);
  }
}

export default router;
