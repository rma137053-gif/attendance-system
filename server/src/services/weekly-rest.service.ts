import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { beijingDayStart, beijingWeekStart, nowBeijing, toBeijing, formatBeijing } from '../utils/timezone';
import { sendAppMessage } from './wechat.service';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface Actor {
  userId: string;
  role: string;
  storeId: string | null;
}

interface ListParams {
  storeId?: string;
  userId?: string;
  weekStart?: string;
  startDate?: string;
  endDate?: string;
}

/** 返回本周周一~周日 UTC */
export function getCurrentWeekWindow() {
  const now = nowBeijing();
  return {
    weekStart: beijingWeekStart(now),
    weekEnd: dayjs.tz(now, 'Asia/Shanghai').endOf('isoWeek').utc().toDate(),
  };
}

/** 根据日期返回所在周的 UTC 边界 */
export function getWeekWindow(dateStr: string) {
  const d = dayjs.tz(dateStr, 'Asia/Shanghai');
  return {
    weekStart: beijingWeekStart(d),
    weekEnd: d.endOf('isoWeek').utc().toDate(),
  };
}

/** 是否在截止时间前（restDate 前一天 23:59 Beijing time） */
export function canStillModify(restDate: dayjs.Dayjs): boolean {
  const deadline = restDate.subtract(1, 'day').endOf('day');
  return nowBeijing().isBefore(deadline);
}

/** 员工选休 / 管理员指定休息日 */
export async function upsertRestDay(
  userId: string,
  storeId: string,
  restDate: string,
  actor: Actor,
  weekStart?: string,
) {
  if (actor.role === 'EMPLOYEE' && actor.userId !== userId) {
    throw new ForbiddenError('只能操作自己的休息日');
  }
  if (actor.role === 'STORE_ADMIN' && actor.storeId && actor.storeId !== storeId) {
    throw new ForbiddenError('只能操作本店员工的休息日');
  }

  const restDay = dayjs.tz(restDate, 'Asia/Shanghai');
  if (!restDay.isValid()) throw new BadRequestError('无效的日期');

  const weekStartDay = weekStart
    ? dayjs.tz(weekStart, 'Asia/Shanghai')
    : restDay.startOf('isoWeek');
  const weekStartUTC = beijingWeekStart(weekStartDay);

  // 截止时间检查（EMPLOYEE）
  if (actor.role === 'EMPLOYEE') {
    const existing = await prisma.weeklyRest.findUnique({
      where: { userId_weekStart: { userId, weekStart: weekStartUTC } },
    });
    // 如果是修改到不同日期且超时，拒绝
    if (existing) {
      const existingRestDate = toBeijing(existing.restDate).format('YYYY-MM-DD');
      if (existingRestDate !== restDate && !canStillModify(restDay)) {
        throw new BadRequestError('已超过修改截止时间（休息日前一天 23:59）');
      }
    } else {
      if (!canStillModify(restDay)) {
        throw new BadRequestError('已超过修改截止时间（休息日前一天 23:59）');
      }
    }
  }

  // 检查该天是否已有排班
  const existingRoster = await prisma.roster.findUnique({
    where: { userId_shiftDate: { userId, shiftDate: beijingDayStart(restDay) } },
  });
  if (existingRoster) {
    throw new BadRequestError('该日期已有排班，不能设为休息日');
  }

  const isNew = !(await prisma.weeklyRest.findUnique({
    where: { userId_weekStart: { userId, weekStart: weekStartUTC } },
  }));

  const result = await prisma.weeklyRest.upsert({
    where: { userId_weekStart: { userId, weekStart: weekStartUTC } },
    create: {
      userId,
      storeId,
      restDate: beijingDayStart(restDay),
      weekStart: weekStartUTC,
      createdBy: actor.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'ADMIN',
    },
    update: {
      restDate: beijingDayStart(restDay),
      createdBy: actor.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'ADMIN',
    },
    include: { user: { select: { id: true, name: true } } },
  });

  // 员工首次选择时通知管理员
  if (isNew && actor.role === 'EMPLOYEE') {
    notifyAdmins(result);
  }

  return result;
}

/** 查询休息日列表 */
export async function listRestDays(params: ListParams, requester: Actor) {
  const where: any = {};

  if (requester.role === 'EMPLOYEE') {
    where.userId = requester.userId;
  } else if (requester.role === 'STORE_ADMIN') {
    where.storeId = requester.storeId;
  } else {
    // ADMIN
    if (params.storeId) where.storeId = params.storeId;
    if (params.userId) where.userId = params.userId;
  }

  if (params.weekStart) {
    const ws = dayjs.tz(params.weekStart, 'Asia/Shanghai');
    where.weekStart = beijingWeekStart(ws.startOf('isoWeek'));
  }
  if (params.startDate) {
    where.restDate = { ...where.restDate, gte: beijingDayStart(dayjs.tz(params.startDate, 'Asia/Shanghai')) };
  }
  if (params.endDate) {
    where.restDate = { ...where.restDate, lte: beijingDayStart(dayjs.tz(params.endDate, 'Asia/Shanghai')) };
  }

  const items = await prisma.weeklyRest.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { restDate: 'asc' },
  });

  return items.map((r) => ({
    ...r,
    restDate: formatBeijing(r.restDate),
    weekStart: formatBeijing(r.weekStart),
    createdAt: formatBeijing(r.createdAt),
    updatedAt: formatBeijing(r.updatedAt),
  }));
}

/** 删除休息日 */
export async function deleteRestDay(restId: string, actor: Actor) {
  const record = await prisma.weeklyRest.findUnique({ where: { id: restId } });
  if (!record) throw new NotFoundError('休息日记录不存在');

  if (actor.role === 'EMPLOYEE') {
    if (record.userId !== actor.userId) throw new ForbiddenError('只能操作自己的休息日');
    if (!canStillModify(toBeijing(record.restDate))) {
      throw new BadRequestError('已超过修改截止时间，无法取消');
    }
  }
  if (actor.role === 'STORE_ADMIN' && actor.storeId && record.storeId !== actor.storeId) {
    throw new ForbiddenError('只能操作本店员工的休息日');
  }

  await prisma.weeklyRest.delete({ where: { id: restId } });
}

/** 获取某门店某周所有员工的休息日 Map<userId, dateStr> */
export async function getRestMapForStore(
  storeId: string,
  weekStartStr: string,
): Promise<Record<string, string>> {
  const ws = dayjs.tz(weekStartStr, 'Asia/Shanghai').startOf('isoWeek');
  const weekStartUTC = beijingWeekStart(ws);

  const items = await prisma.weeklyRest.findMany({
    where: { storeId, weekStart: weekStartUTC },
    select: { userId: true, restDate: true },
  });

  const map: Record<string, string> = {};
  for (const item of items) {
    map[item.userId] = toBeijing(item.restDate).format('YYYY-MM-DD');
  }
  return map;
}

/** 通知所有绑定企微的管理员 */
async function notifyAdmins(rest: { userId: string; restDate: Date; user?: { id: string; name: string } }) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', wechatUserId: { not: null } },
      select: { wechatUserId: true },
    });
    if (admins.length === 0) return;

    const employeeName = rest.user?.name || '员工';
    const restDateStr = toBeijing(rest.restDate).format('YYYY-MM-DD');
    const weekday = WEEKDAY_CN[toBeijing(rest.restDate).day()];
    const content = `${employeeName} 选择了 ${restDateStr}（${weekday}）为本周休息日\n\n请及时调整排班`;

    for (const admin of admins) {
      sendAppMessage({
        touser: admin.wechatUserId!,
        title: '员工选休通知',
        content,
        url: 'http://47.102.223.195/roster/#/manage',
      }).catch((err) => console.error('[WeChat] 选休通知发送失败:', err.message));
    }
  } catch (err: any) {
    console.error('[WeChat] 查询管理员失败:', err.message);
  }
}
