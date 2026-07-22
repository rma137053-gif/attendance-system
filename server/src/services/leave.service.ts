import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { beijingDayStart, beijingDayEnd, toBeijing } from '../utils/timezone';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const LEAVE_TYPE_CN: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
};

interface ListLeavesParams {
  storeId?: string;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export async function listLeaves(params: ListLeavesParams) {
  const { storeId, status, userId, startDate, endDate, page = 1, pageSize = 20 } = params;
  const where: any = {};
  if (storeId) where.storeId = storeId;
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    if (startDate) {
      where.startDate = { gte: beijingDayStart(dayjs.tz(startDate, 'Asia/Shanghai')) };
    }
    if (endDate) {
      where.endDate = { lte: beijingDayEnd(dayjs.tz(endDate, 'Asia/Shanghai')) };
    }
  }

  const [items, total] = await Promise.all([
    prisma.leave.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, store: { select: { id: true, name: true } } } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leave.count({ where }),
  ]);

  return {
    items: items.map((l) => ({ ...l, typeLabel: LEAVE_TYPE_CN[l.type] || l.type })),
    total,
    page,
    pageSize,
  };
}

export async function createLeave(
  userId: string,
  storeId: string,
  type: string,
  startDate: string,
  endDate: string,
  reason?: string,
) {
  if (!['ANNUAL', 'SICK', 'PERSONAL'].includes(type)) {
    throw new BadRequestError('无效的请假类型');
  }

  const startDay = dayjs.tz(startDate, 'Asia/Shanghai');
  const endDay = dayjs.tz(endDate, 'Asia/Shanghai');

  if (endDay.isBefore(startDay)) {
    throw new BadRequestError('结束日期不能早于开始日期');
  }

  const start = beijingDayStart(startDay);
  const end = beijingDayEnd(endDay);

  // 检查是否有重叠的已审批/待审批请假
  const overlapping = await prisma.leave.findFirst({
    where: {
      userId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlapping) {
    throw new BadRequestError('该时间段与已有请假记录重叠，请检查后重试');
  }

  return prisma.leave.create({
    data: { userId, storeId, type, startDate: start, endDate: end, reason },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
}

export async function updateLeave(
  leaveId: string,
  data: { type?: string; startDate?: string; endDate?: string; reason?: string },
  actor: { userId: string; role: string; storeId: string | null },
) {
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
  if (!leave) throw new NotFoundError('请假记录不存在');

  // Permission check
  if (actor.role === 'ADMIN') {
    // ADMIN can edit any leave, any status
  } else if (actor.role === 'STORE_ADMIN') {
    // STORE_ADMIN can edit leaves for employees in their store
    if (!actor.storeId) throw new ForbiddenError('无门店归属');
    const leaveUser = await prisma.user.findUnique({ where: { id: leave.userId }, select: { storeId: true } });
    if (!leaveUser || leaveUser.storeId !== actor.storeId) {
      throw new ForbiddenError('只能操作本店员工的请假');
    }
    if (leave.status !== 'PENDING') throw new BadRequestError('只能修改待审批的请假');
  } else {
    // EMPLOYEE can always edit their own leave
    if (leave.userId !== actor.userId) throw new ForbiddenError('只能操作自己的请假');
  }

  const updateData: any = {};
  if (data.type) {
    if (!['ANNUAL', 'SICK', 'PERSONAL'].includes(data.type)) {
      throw new BadRequestError('无效的请假类型');
    }
    updateData.type = data.type;
  }
  if (data.startDate) {
    updateData.startDate = beijingDayStart(dayjs.tz(data.startDate, 'Asia/Shanghai'));
  }
  if (data.endDate) {
    updateData.endDate = beijingDayEnd(dayjs.tz(data.endDate, 'Asia/Shanghai'));
  }
  if (data.reason !== undefined) updateData.reason = data.reason;

  return prisma.leave.update({
    where: { id: leaveId },
    data: updateData,
    include: {
      user: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
  });
}

export async function approveLeave(leaveId: string, approverId: string) {
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
  if (!leave) throw new NotFoundError('请假记录不存在');
  if (leave.status !== 'PENDING') throw new BadRequestError('该请假已处理');

  return prisma.leave.update({
    where: { id: leaveId },
    data: { status: 'APPROVED', approverId },
    include: {
      user: { select: { id: true, name: true, wechatUserId: true } },
      approver: { select: { id: true, name: true } },
    },
  });
}

export async function rejectLeave(leaveId: string, approverId: string) {
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
  if (!leave) throw new NotFoundError('请假记录不存在');
  if (leave.status !== 'PENDING') throw new BadRequestError('该请假已处理');

  return prisma.leave.update({
    where: { id: leaveId },
    data: { status: 'REJECTED', approverId },
    include: {
      user: { select: { id: true, name: true, wechatUserId: true } },
      approver: { select: { id: true, name: true } },
    },
  });
}

export async function deleteLeave(leaveId: string) {
  const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
  if (!leave) throw new NotFoundError('请假记录不存在');

  await prisma.leave.delete({ where: { id: leaveId } });
}

/**
 * 查询某用户已审批请假覆盖的日期集合（YYYY-MM-DD 北京日期）
 * 供 clockReminder、recordService、reportService 等模块调用
 */
export async function getApprovedLeaveDates(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Set<string>> {
  const leaves = await prisma.leave.findMany({
    where: {
      userId,
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { startDate: true, endDate: true },
  });

  const dates = new Set<string>();
  for (const l of leaves) {
    let d = dayjs.utc(l.startDate).tz('Asia/Shanghai');
    const end = dayjs.utc(l.endDate).tz('Asia/Shanghai');
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      dates.add(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  }
  return dates;
}

/** 月度请假统计（管理员视角），按年假/病假/事假分类 */
export async function getMonthlyLeaveSummary(storeId: string | null, monthStr: string) {
  const month = dayjs.tz(monthStr, 'Asia/Shanghai');
  const monthStart = beijingDayStart(month.startOf('month'));
  const monthEnd = beijingDayEnd(month.endOf('month'));

  const userWhere: any = { status: 'ACTIVE', role: 'EMPLOYEE' };
  if (storeId) userWhere.storeId = storeId;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, store: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const leaves = await prisma.leave.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      status: { in: ['APPROVED', 'PENDING'] },
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    select: { userId: true, type: true, startDate: true, endDate: true },
  });

  type LeaveInfo = { annual: number; sick: number; personal: number; dates: string[] };
  const leaveByUser: Record<string, LeaveInfo> = {};

  for (const l of leaves) {
    if (!leaveByUser[l.userId]) leaveByUser[l.userId] = { annual: 0, sick: 0, personal: 0, dates: [] };
    const info = leaveByUser[l.userId];
    let d = toBeijing(l.startDate);
    const end = toBeijing(l.endDate);
    const mStart = toBeijing(monthStart);
    const mEnd = toBeijing(monthEnd);
    if (d.isBefore(mStart)) d = mStart;
    const effEnd = end.isAfter(mEnd) ? mEnd : end;
    let cnt = 0;
    while (d.isBefore(effEnd) || d.isSame(effEnd, 'day')) {
      info.dates.push(d.format('YYYY-MM-DD'));
      cnt++;
      d = d.add(1, 'day');
    }
    if (l.type === 'ANNUAL') info.annual += cnt;
    else if (l.type === 'SICK') info.sick += cnt;
    else info.personal += cnt;
  }

  return users.map((u) => {
    const info = leaveByUser[u.id] || { annual: 0, sick: 0, personal: 0, dates: [] };
    return {
      userId: u.id, userName: u.name, storeName: u.store?.name ?? '',
      totalDays: info.annual + info.sick + info.personal,
      annualDays: info.annual, sickDays: info.sick, personalDays: info.personal,
      dates: info.dates.sort(),
    };
  });
}
