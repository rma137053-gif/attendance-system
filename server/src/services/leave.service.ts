import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { beijingDayStart, beijingDayEnd } from '../utils/timezone';
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
    where.startDate = {};
    if (startDate) where.startDate.gte = beijingDayStart(dayjs.tz(startDate, 'Asia/Shanghai'));
    if (endDate) where.endDate.lte = beijingDayEnd(dayjs.tz(endDate, 'Asia/Shanghai'));
  }

  const [items, total] = await Promise.all([
    prisma.leave.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
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
  // ADMIN 可操作任意，EMPLOYEE 只能操作自己的 PENDING 请假
  if (actor.role !== 'ADMIN') {
    if (actor.role === 'STORE_ADMIN') throw new ForbiddenError('无权限操作请假');
    if (leave.userId !== actor.userId) throw new ForbiddenError('只能操作自己的请假');
  }
  if (leave.status !== 'PENDING') throw new BadRequestError('只能修改待审批的请假');

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
