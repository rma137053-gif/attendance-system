import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { ForbiddenError } from '../utils/errors';
import { sendAppMessage } from '../services/wechat.service';
import * as leaveService from '../services/leave.service';

dayjs.extend(utc);
dayjs.extend(tz);

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

    if (role === 'STORE_ADMIN') {
      // STORE_ADMIN can view their store's leaves only
      const result = await leaveService.listLeaves({
        storeId: req.user!.storeId!,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      });
      res.json(result);
      return;
    }

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

    if (role === 'STORE_ADMIN') {
      // STORE_ADMIN can create leave for store employees
      const body = createSchema.parse(req.body);
      if (!body.userId) throw new ForbiddenError('请选择员工');
      const targetUser = await prisma.user.findUnique({ where: { id: body.userId }, select: { storeId: true } });
      if (!targetUser || !targetUser.storeId || targetUser.storeId !== storeId) throw new ForbiddenError('只能为本店员工发起请假');
      const leave = await leaveService.createLeave(
        body.userId, targetUser.storeId!, body.type, body.startDate, body.endDate, body.reason,
      );
      const employeeName = (leave as any).user?.name || '员工';
      notifyAdmins(leave.id, employeeName, body.type, body.startDate, body.endDate, body.reason);
      res.status(201).json(leave);
      return;
    }

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
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { storeId: true } });
      if (!targetUser?.storeId) throw new ForbiddenError('该员工无归属门店');
      targetStoreId = targetUser.storeId;
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
    // 通知员工
    notifyEmployee(leave, 'APPROVED');
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
    // 通知员工
    notifyEmployee(leave, 'REJECTED');
    res.json(leave);
  } catch (err) {
    next(err);
  }
});

// 删除请假 — ADMIN 或 STORE_ADMIN（限本店）
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, storeId } = req.user!;
    if (role !== 'ADMIN' && role !== 'STORE_ADMIN') throw new ForbiddenError();
    if (role === 'STORE_ADMIN') {
      const leave = await prisma.leave.findUnique({ where: { id: req.params.id as string }, select: { userId: true } });
      if (!leave) throw new ForbiddenError('请假记录不存在');
      const leaveUser = await prisma.user.findUnique({ where: { id: leave.userId }, select: { storeId: true } });
      if (!leaveUser || leaveUser.storeId !== storeId) throw new ForbiddenError('只能操作本店员工的请假');
    }
    await leaveService.deleteLeave(req.params.id as string);
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

/** 向员工发送审批结果通知 */
function notifyEmployee(leave: any, newStatus: 'APPROVED' | 'REJECTED') {
  const wechatUserId = leave.user?.wechatUserId;
  if (!wechatUserId) return;

  const typeLabel = LEAVE_TYPE_CN[leave.type] || leave.type;
  const startDate = dayjs.utc(leave.startDate).tz('Asia/Shanghai').format('M月D日');
  const endDate = dayjs.utc(leave.endDate).tz('Asia/Shanghai').format('M月D日');
  const dateRange = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;

  if (newStatus === 'APPROVED') {
    const reasonPart = leave.reason ? `\n原因：${leave.reason}` : '';
    sendAppMessage({
      touser: wechatUserId,
      content: `【请假已通过】\n您的请假申请已审批通过！\n\n类型：${typeLabel}\n日期：${dateRange}${reasonPart}\n\n祝您休息愉快！`,
    }).catch((err: any) => console.error('[WeChat] 审批通过通知发送失败:', err.message));
  } else {
    const reasonPart = leave.reason ? `\n原因：${leave.reason}` : '';
    sendAppMessage({
      touser: wechatUserId,
      content: `【请假已拒绝】\n您的请假申请已被拒绝。\n\n类型：${typeLabel}\n日期：${dateRange}${reasonPart}\n\n如有疑问请联系管理员。`,
    }).catch((err: any) => console.error('[WeChat] 审批拒绝通知发送失败:', err.message));
  }
}

/** 向所有已绑定企业微信的管理员 + 麻伦熙发送请假审批通知 */
const NOTIFY_EXTRA = ['MaLunXi'];

async function notifyAdmins(
  leaveId: string, employeeName: string, type: string,
  startDate: string, endDate: string, reason?: string,
) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', wechatUserId: { not: null } },
      select: { wechatUserId: true },
    });

    const recipients = new Set([...admins.map((a) => a.wechatUserId!), ...NOTIFY_EXTRA]);
    if (recipients.size === 0) return;

    const typeLabel = LEAVE_TYPE_CN[type] || type;
    const content = `【${typeLabel}】${employeeName}\n日期：${startDate} ~ ${endDate}\n原因：${reason || '无'}\n\n请及时审批`;

    for (const touser of recipients) {
      sendAppMessage({
        touser,
        title: '新的请假申请',
        content,
        url: 'http://47.102.223.195/admin/leaves',
      }).catch((err: any) => console.error('[WeChat] 请假通知发送失败:', err.message));
    }
  } catch (err: any) {
    console.error('[WeChat] 查询管理员失败:', err.message);
  }
}

// 月度请假统计（管理员 + 店长）
router.get('/monthly-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, storeId } = req.user!;
    if (role === 'EMPLOYEE') throw new ForbiddenError('仅管理员可查看');
    const effectiveStoreId = role === 'ADMIN' ? (req.query.storeId as string) || null : storeId;
    const month = (req.query.month as string) || dayjs().tz('Asia/Shanghai').format('YYYY-MM');
    const summary = await leaveService.getMonthlyLeaveSummary(effectiveStoreId, month);
    res.json(summary);
  } catch (err) { next(err); }
});

export default router;
