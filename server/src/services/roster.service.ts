import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { beijingDayStart, beijingDayEnd, nowBeijing, formatBeijing } from '../utils/timezone';
import { sendAppMessage } from './wechat.service';
import { getApprovedLeaveDates } from './leave.service';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function fireWechat(
  user: { name: string; wechatUserId: string | null },
  title: string,
  content: string,
) {
  if (!user.wechatUserId) return;
  sendAppMessage({
    touser: user.wechatUserId,
    title,
    content,
    url: 'http://47.102.223.195/roster/#/week',
  }).catch((e) =>
    console.error(`[排班通知] 发送失败: ${user.name}`, e.message),
  );
}

interface BatchAssignment {
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}

export async function batchUpsertRoster(
  storeId: string,
  assignments: BatchAssignment[],
  requesterStoreId: string | null,
) {
  if (requesterStoreId && requesterStoreId !== storeId) {
    throw new ForbiddenError('只能操作本店排班');
  }

  if (assignments.length === 0) {
    throw new BadRequestError('排班数据不能为空');
  }

  for (const a of assignments) {
    if (!/^\d{2}:\d{2}$/.test(a.startTime) || !/^\d{2}:\d{2}$/.test(a.endTime)) {
      throw new BadRequestError(`无效的时间格式: ${a.startTime}-${a.endTime}`);
    }
  }

  const userIds = [...new Set(assignments.map((a) => a.userId))];
  const [users, store] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } } }),
    prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
  ]);
  const storeName = store?.name ?? '';
  const userMap = new Map(users.map((u) => [u.id, u]));

  for (const a of assignments) {
    const user = userMap.get(a.userId);
    if (!user) throw new BadRequestError(`员工不存在: ${a.userId}`);
    if (user.storeId !== storeId) throw new BadRequestError(`${user.name} 不是本店员工`);
  }

  // 检查排班日期是否与员工已选休息日冲突
  const restDates = [...new Set(assignments.map((a) => beijingDayStart(dayjs.tz(a.shiftDate, 'Asia/Shanghai')).toISOString()))];
  if (restDates.length > 0) {
    const conflicts = await prisma.weeklyRest.findMany({
      where: {
        userId: { in: userIds },
        restDate: { in: restDates.map((d) => new Date(d)) },
      },
      select: { userId: true, restDate: true },
    });
    if (conflicts.length > 0) {
      const conflictMap = new Map<string, string>();
      for (const c of conflicts) {
        conflictMap.set(
          `${c.userId}_${dayjs.utc(c.restDate).tz('Asia/Shanghai').format('YYYY-MM-DD')}`,
          userMap.get(c.userId)?.name || c.userId,
        );
      }
      for (const a of assignments) {
        const key = `${a.userId}_${a.shiftDate}`;
        const name = conflictMap.get(key);
        if (name) throw new BadRequestError(`${name} 在 ${a.shiftDate} 已选择休息日，不可排班`);
      }
    }
  }

  const existingRosters = await prisma.roster.findMany({
    where: {
      OR: assignments.map((a) => ({
        userId: a.userId,
        shiftDate: beijingDayStart(dayjs.tz(a.shiftDate, 'Asia/Shanghai')),
      })),
    },
  });
  const existingMap = new Map(
    existingRosters.map((r) => [`${r.userId}_${r.shiftDate.toISOString()}`, r]),
  );

  let created = 0;
  let updated = 0;
  const notifications: { user: { name: string; wechatUserId: string | null }; title: string; content: string }[] = [];

  const writes = assignments.map((a) => {
    const shiftDateUTC = beijingDayStart(dayjs.tz(a.shiftDate, 'Asia/Shanghai'));
    const key = `${a.userId}_${shiftDateUTC.toISOString()}`;
    const existing = existingMap.get(key);

    const breakMin = a.breakMinutes ?? existing?.breakMinutes ?? 0;
    const user = userMap.get(a.userId)!;

    const d = dayjs.tz(a.shiftDate, 'Asia/Shanghai');
    const dateStr = d.format('M月D日');
    const weekday = WEEKDAY_CN[d.day()];

    if (existing) {
      updated++;
      const breakInfo = breakMin > 0 ? `\n休息时间：${breakMin}分钟` : '';
      notifications.push({
        user,
        title: '排班已更新',
        content: `【${storeName}】\n${d.format('YYYY年M月D日')} ${weekday}\n班次：${a.startTime} - ${a.endTime}${breakInfo}\n\n请留意最新排班安排，点击查看本周排班详情`,
      });
      return prisma.roster.update({
        where: { id: existing.id },
        data: { startTime: a.startTime, endTime: a.endTime, breakMinutes: breakMin },
      });
    } else {
      created++;
      const breakInfo = breakMin > 0 ? `\n休息时间：${breakMin}分钟` : '';
      notifications.push({
        user,
        title: '新排班通知',
        content: `【${storeName}】\n${d.format('YYYY年M月D日')} ${weekday}\n班次：${a.startTime} - ${a.endTime}${breakInfo}\n\n请准时到岗，点击查看本周排班详情`,
      });
      return prisma.roster.create({
        data: {
          storeId,
          userId: a.userId,
          shiftDate: shiftDateUTC,
          startTime: a.startTime,
          endTime: a.endTime,
          breakMinutes: breakMin,
        },
      });
    }
  });

  await prisma.$transaction(writes);

  // Fire-and-forget WeChat notifications
  for (const n of notifications) {
    fireWechat(n.user, n.title, n.content);
  }

  return { created, updated };
}

interface QueryRosterParams {
  storeId?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  requesterUserId?: string;
  requesterRole?: string;
}

export async function queryRoster(
  params: QueryRosterParams,
  requesterStoreId: string | null,
) {
  const { storeId, startDate, endDate, userId, requesterUserId, requesterRole } = params;

  const where: Prisma.RosterWhereInput = {};

  // Store scoping
  const effectiveStoreId = requesterStoreId ?? storeId ?? undefined;
  if (effectiveStoreId) {
    where.storeId = effectiveStoreId;
  }

  // EMPLOYEE can only see their own roster
  if (requesterRole === 'EMPLOYEE') {
    where.userId = requesterUserId;
  } else if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.shiftDate = {};
    if (startDate) {
      (where.shiftDate as Prisma.DateTimeFilter).gte = beijingDayStart(dayjs.tz(startDate, 'Asia/Shanghai'));
    }
    if (endDate) {
      (where.shiftDate as Prisma.DateTimeFilter).lte = beijingDayEnd(dayjs.tz(endDate, 'Asia/Shanghai'));
    }
  }

  const rosters = await prisma.roster.findMany({
    where: {
      ...where,
      user: { role: 'EMPLOYEE' },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
  });

  // Fetch CLOCK_OUT records for overtime calculation
  const rosterUserIds = [...new Set(rosters.map((r) => r.userId))];
  let clockOutMap = new Map<string, number>(); // key: `${userId}_${dateStr}`, value: clock-out Beijing minutes

  if (rosterUserIds.length > 0) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = beijingDayStart(dayjs.tz(startDate, 'Asia/Shanghai'));
    if (endDate) dateFilter.lte = beijingDayEnd(dayjs.tz(endDate, 'Asia/Shanghai'));
    // Extend to cover all roster dates if no explicit date filter
    if (!startDate && !endDate && rosters.length > 0) {
      const minDate = rosters.reduce((min, r) => r.shiftDate < min ? r.shiftDate : min, rosters[0].shiftDate);
      const maxDate = rosters.reduce((max, r) => r.shiftDate > max ? r.shiftDate : max, rosters[0].shiftDate);
      dateFilter.gte = beijingDayStart(dayjs(minDate).tz('Asia/Shanghai'));
      dateFilter.lte = beijingDayEnd(dayjs(maxDate).tz('Asia/Shanghai'));
    }

    const clockOuts = await prisma.clockRecord.findMany({
      where: {
        userId: { in: rosterUserIds },
        type: 'CLOCK_OUT',
        createdAt: dateFilter,
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Build map: keep latest clock-out per user per day
    for (const c of clockOuts) {
      const bjTime = dayjs.utc(c.createdAt).tz('Asia/Shanghai');
      const dateStr = bjTime.format('YYYY-MM-DD');
      const key = `${c.userId}_${dateStr}`;
      if (!clockOutMap.has(key)) {
        clockOutMap.set(key, bjTime.hour() * 60 + bjTime.minute());
      }
    }
  }

  // Fetch approved leaves for the date range to build leaveMap
  const leaveMap = new Map<string, string>(); // key: `${userId}_${dateStr}`, value: leaveType
  if (rosterUserIds.length > 0 || (startDate && endDate)) {
    const leaveDateFilter: any = {};
    if (startDate) leaveDateFilter.gte = beijingDayStart(dayjs.tz(startDate, 'Asia/Shanghai'));
    if (endDate) leaveDateFilter.lte = beijingDayEnd(dayjs.tz(endDate, 'Asia/Shanghai'));
    if (!startDate && !endDate && rosters.length > 0) {
      const minDate = rosters.reduce((min, r) => r.shiftDate < min ? r.shiftDate : min, rosters[0].shiftDate);
      const maxDate = rosters.reduce((max, r) => r.shiftDate > max ? r.shiftDate : max, rosters[0].shiftDate);
      leaveDateFilter.gte = beijingDayStart(dayjs(minDate).tz('Asia/Shanghai'));
      leaveDateFilter.lte = beijingDayEnd(dayjs(maxDate).tz('Asia/Shanghai'));
    }

    if (leaveDateFilter.gte && leaveDateFilter.lte) {
      const allUserIds = rosterUserIds.length > 0
        ? rosterUserIds
        : (userId ? [userId] : []);

      if (allUserIds.length > 0 || requesterRole === 'EMPLOYEE' && requesterUserId) {
        const leaveQueryIds = allUserIds.length > 0 ? allUserIds : [requesterUserId!];
        const approvedLeaves = await prisma.leave.findMany({
          where: {
            userId: { in: leaveQueryIds },
            status: 'APPROVED',
            startDate: { lte: leaveDateFilter.lte },
            endDate: { gte: leaveDateFilter.gte },
          },
          select: { userId: true, startDate: true, endDate: true, type: true },
        });

        for (const l of approvedLeaves) {
          let d = dayjs.utc(l.startDate).tz('Asia/Shanghai');
          const end = dayjs.utc(l.endDate).tz('Asia/Shanghai');
          while (d.isBefore(end) || d.isSame(end, 'day')) {
            const dateStr = d.format('YYYY-MM-DD');
            const key = `${l.userId}_${dateStr}`;
            if (!leaveMap.has(key)) {
              leaveMap.set(key, l.type);
            }
            d = d.add(1, 'day');
          }
        }
      }
    }
  }

  const items = rosters.map((r) => {
    const dateStr = dayjs(r.shiftDate).format('YYYY-MM-DD');
    const clockOutKey = `${r.userId}_${dateStr}`;
    const clockOutMin = clockOutMap.get(clockOutKey);
    let overtimeMinutes = 0;
    if (clockOutMin != null) {
      const [eh, em] = r.endTime.split(':').map(Number);
      const endMin = eh * 60 + em;
      if (clockOutMin > endMin) {
        overtimeMinutes = clockOutMin - endMin;
      }
    }
    const leaveKey = `${r.userId}_${dateStr}`;
    return {
      ...r,
      shiftDate: formatBeijing(r.shiftDate),
      overtimeMinutes,
      leaveType: leaveMap.get(leaveKey) || null,
    };
  });

  // Convert leaveMap to plain object keyed by `${userId}_${dateStr}`
  const leaveMapObj: Record<string, string> = {};
  for (const [k, v] of leaveMap) {
    leaveMapObj[k] = v;
  }

  return { items, leaveMap: leaveMapObj };
}

export async function getTodayRoster(userId: string, requesterStoreId: string | null, role?: string) {
  const today = nowBeijing();
  const dayStart = beijingDayStart(today);
  const dayEnd = beijingDayEnd(today);

  // Get my today's roster
  const myRoster = await prisma.roster.findFirst({
    where: {
      userId,
      shiftDate: { gte: dayStart, lte: dayEnd },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Admin / Store admin with no personal roster: show all today's rosters grouped by store
  if (!myRoster && (role === 'ADMIN' || role === 'STORE_ADMIN')) {
    const where: any = {
      shiftDate: { gte: dayStart, lte: dayEnd },
      user: { role: 'EMPLOYEE' },
    };
    if (requesterStoreId) where.storeId = requesterStoreId;

    const allRosters = await prisma.roster.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: [{ storeId: 'asc' }, { startTime: 'asc' }],
    });

    return {
      myShift: null,
      overview: allRosters.map((r) => ({
        id: r.id,
        startTime: r.startTime,
        endTime: r.endTime,
        user: r.user,
        store: r.store,
      })),
    };
  }

  if (!myRoster) {
    return {
      myShift: null,
      colleagues: [],
      handoverFrom: null,
      handoverTo: null,
      handoverNotes: [],
    };
  }

  // Store scoping
  if (requesterStoreId && myRoster.storeId !== requesterStoreId) {
    throw new ForbiddenError('只能查看本店排班');
  }

  const storeId = myRoster.storeId;

  // Colleagues: all other rosters today in the same store (excluding self)
  const allTodayRosters = await prisma.roster.findMany({
    where: {
      storeId,
      shiftDate: { gte: dayStart, lte: dayEnd },
      userId: { not: userId },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  // Parse my shift times for comparison
  const myStart = parseTimeMinutes(myRoster.startTime);
  const myEnd = parseTimeMinutes(myRoster.endTime);

  // handoverFrom: colleagues whose end time is within 60 min of my start time
  const handoverFrom = allTodayRosters.filter((r) => {
    const end = parseTimeMinutes(r.endTime);
    const diff = myStart - end;
    return diff >= 0 && diff <= 60;
  });

  // handoverTo: colleagues whose start time is within 60 min of my end time
  const handoverTo = allTodayRosters.filter((r) => {
    const start = parseTimeMinutes(r.startTime);
    const diff = start - myEnd;
    return diff >= 0 && diff <= 60;
  });

  // Handover notes for my roster
  const handoverNotes = await prisma.handoverNote.findMany({
    where: { rosterId: myRoster.id },
    include: {
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });


  // Check if user is on approved leave today
  const leaveDates = await getApprovedLeaveDates(userId, dayStart, dayEnd);
  const onLeave = leaveDates.has(today.format('YYYY-MM-DD'));
  return {
    myShift: {
      id: myRoster.id,
      startTime: myRoster.startTime,
      endTime: myRoster.endTime,
      shiftDate: formatBeijing(myRoster.shiftDate),
      user: myRoster.user,
	      onLeave,
    },
    colleagues: allTodayRosters.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    handoverFrom: handoverFrom.length > 0
      ? handoverFrom.map((r) => ({
          id: r.id,
          user: r.user,
          startTime: r.startTime,
          endTime: r.endTime,
        }))
      : null,
    handoverTo: handoverTo.length > 0
      ? handoverTo.map((r) => ({
          id: r.id,
          user: r.user,
          startTime: r.startTime,
          endTime: r.endTime,
        }))
      : null,
    handoverNotes: handoverNotes.map((n) => ({
      id: n.id,
      content: n.content,
      author: n.author,
      createdAt: formatBeijing(n.createdAt),
    })),
  };
}

export async function deleteRoster(rosterId: string, requesterStoreId: string | null) {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: {
      user: { select: { id: true, name: true, wechatUserId: true } },
      store: { select: { name: true } },
    },
  });
  if (!roster) throw new NotFoundError('排班记录不存在');
  if (requesterStoreId && roster.storeId !== requesterStoreId) {
    throw new ForbiddenError('只能操作本店排班');
  }

  await prisma.roster.delete({ where: { id: rosterId } });

  // Fire-and-forget WeChat notification
  const d = dayjs.utc(roster.shiftDate).tz('Asia/Shanghai');
  fireWechat(
    roster.user,
    '排班已取消',
    `【${roster.store?.name ?? ''}】\n${d.format('YYYY年M月D日')} ${WEEKDAY_CN[d.day()]}\n原班次：${roster.startTime} - ${roster.endTime}\n\n该班次已被管理员取消，如有疑问请联系店长。点击查看本周排班`,
  );
}

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
