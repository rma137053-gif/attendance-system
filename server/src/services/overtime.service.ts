import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { beijingDayStart, beijingDayEnd, formatBeijing } from '../utils/timezone';
import { sendAppMessage } from './wechat.service';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

interface OvertimeInput {
  userId: string;
  storeId: string;
  date: string;
  startTime: string;
  endTime: string;
  type?: string;
  coveredUserId?: string;
  reason?: string;
}

function notifyOvertime(params: {
  action: 'created' | 'updated' | 'deleted';
  type: string;
  userName: string;
  wechatUserId: string | null;
  coveredUserName?: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason?: string;
  storeName: string;
}) {
  const { action, type, userName, wechatUserId, coveredUserName, date, startTime, endTime, hours, reason, storeName } = params;
  if (!wechatUserId) return;

  const dateLabel = dayjs(date).format('M月D日（ddd）');
  const isCoverage = type === 'COVERAGE';
  const typeLabel = isCoverage ? '顶班' : '加班';
  const actionLabel = action === 'created' ? '新增' : action === 'updated' ? '更新' : '取消';
  const reasonStr = reason ? `\n原因：${reason}` : '';
  const coverageStr = isCoverage && coveredUserName ? `\n被顶替员工：${coveredUserName}` : '';

  sendAppMessage({
    touser: wechatUserId,
    title: `${typeLabel}${actionLabel}通知 — ${userName}`,
    content: [
      `${userName} 你好，你的${typeLabel}已${actionLabel}：`,
      `门店：${storeName}`,
      `日期：${dateLabel}`,
      `时间：${startTime}-${endTime}`,
      `时长：${hours}小时`,
      coverageStr,
      reasonStr,
    ].filter(Boolean).join('\n'),
  }).catch(() => {});
}

export async function listOvertime(params: {
  storeId?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  type?: string;
  requesterStoreId: string | null;
  requesterRole: string;
}) {
  const { storeId, startDate, endDate, userId, type, requesterStoreId, requesterRole } = params;

  const where: any = {};

  if (requesterRole !== 'ADMIN') {
    where.storeId = requesterStoreId;
  } else if (storeId) {
    where.storeId = storeId;
  }

  if (startDate && endDate) {
    where.date = {
      gte: beijingDayStart(dayjs(startDate)),
      lte: beijingDayEnd(dayjs(endDate)),
    };
  }

  if (userId) {
    where.userId = userId;
  }
  if (type) {
    where.type = type;
  }

  const records = await prisma.overtimeRecord.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
      coveredUser: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  let totalHours = 0;
  const items = records.map((r) => {
    totalHours += r.hours;
    return {
      ...r,
      date: formatBeijing(r.date).substring(0, 10),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  return { items, totalHours: Math.round(totalHours * 10) / 10 };
}

export async function createOvertime(data: OvertimeInput, requesterStoreId: string | null, requesterRole: string) {
  if (requesterRole !== 'ADMIN') {
    throw new ForbiddenError('仅管理员可操作加班');
  }

  if (!/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime)) {
    throw new BadRequestError('时间格式无效');
  }

  const [sh, sm] = data.startTime.split(':').map(Number);
  const [eh, em] = data.endTime.split(':').map(Number);
  const hours = (eh * 60 + em - sh * 60 - sm) / 60;

  if (hours <= 0) {
    throw new BadRequestError('结束时间必须晚于开始时间');
  }

  const user = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true, name: true, wechatUserId: true } });
  if (!user) throw new NotFoundError('员工不存在');

  const date = beijingDayStart(dayjs(data.date));

  const record = await prisma.overtimeRecord.create({
    data: {
      userId: data.userId,
      storeId: data.storeId,
      date,
      startTime: data.startTime,
      endTime: data.endTime,
      hours: Math.round(hours * 10) / 10,
      type: data.type || 'VOLUNTARY',
      coveredUserId: data.coveredUserId || null,
      reason: data.reason || null,
    },
    include: {
      user: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
      coveredUser: { select: { id: true, name: true } },
    },
  });

  // WeChat notification (fire-and-forget)
  notifyOvertime({
    action: 'created',
    type: data.type || 'VOLUNTARY',
    userName: user.name,
    wechatUserId: user.wechatUserId,
    coveredUserName: record.coveredUser?.name,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    hours: Math.round(hours * 10) / 10,
    reason: data.reason,
    storeName: record.store.name,
  });

  return {
    ...record,
    date: formatBeijing(record.date).substring(0, 10),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function updateOvertime(id: string, data: Partial<OvertimeInput>, requesterRole: string) {
  if (requesterRole !== 'ADMIN') {
    throw new ForbiddenError('仅管理员可操作加班');
  }

  const existing = await prisma.overtimeRecord.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, wechatUserId: true } },
      store: { select: { id: true, name: true } },
      coveredUser: { select: { id: true, name: true } },
    },
  });
  if (!existing) throw new NotFoundError('加班记录不存在');

  const updateData: any = {};
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.reason !== undefined) updateData.reason = data.reason;
  if (data.date !== undefined) updateData.date = beijingDayStart(dayjs(data.date));

  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  if (data.startTime !== undefined || data.endTime !== undefined) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const hours = (eh * 60 + em - sh * 60 - sm) / 60;
    if (hours <= 0) throw new BadRequestError('结束时间必须晚于开始时间');
    updateData.hours = Math.round(hours * 10) / 10;
  }

  const record = await prisma.overtimeRecord.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
      coveredUser: { select: { id: true, name: true } },
    },
  });

  // WeChat notification
  notifyOvertime({
    action: 'updated',
    type: existing.type,
    userName: existing.user.name,
    wechatUserId: existing.user.wechatUserId,
    coveredUserName: existing.coveredUser?.name,
    date: data.date ?? formatBeijing(existing.date).substring(0, 10),
    startTime,
    endTime,
    hours: updateData.hours ?? existing.hours,
    reason: data.reason ?? existing.reason ?? undefined,
    storeName: existing.store.name,
  });

  return {
    ...record,
    date: formatBeijing(record.date).substring(0, 10),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function deleteOvertime(id: string, requesterRole: string) {
  if (requesterRole !== 'ADMIN') {
    throw new ForbiddenError('仅管理员可操作加班');
  }

  const existing = await prisma.overtimeRecord.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, wechatUserId: true } },
      store: { select: { id: true, name: true } },
      coveredUser: { select: { id: true, name: true } },
    },
  });
  if (!existing) throw new NotFoundError('加班记录不存在');

  await prisma.overtimeRecord.delete({ where: { id } });

  // WeChat notification
  notifyOvertime({
    action: 'deleted',
    type: existing.type,
    userName: existing.user.name,
    wechatUserId: existing.user.wechatUserId,
    coveredUserName: existing.coveredUser?.name,
    date: formatBeijing(existing.date).substring(0, 10),
    startTime: existing.startTime,
    endTime: existing.endTime,
    hours: existing.hours,
    storeName: existing.store.name,
  });
}
