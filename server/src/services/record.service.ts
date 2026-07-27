import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { formatBeijing, toBeijing, beijingDayStart, beijingDayEnd, nowBeijing } from '../utils/timezone';
import { calcLateMinutes, parseTimeToBeijing } from '../utils/roster';
import { savePhoto, getPhoto, deletePhoto } from './storage.service';
import { getApprovedLeaveDates } from './leave.service';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const CLOCK_IN_WINDOW_START = 5;
const CLOCK_IN_WINDOW_END = 23;
const CLOCK_OUT_WINDOW_START = 12;
const CLOCK_OUT_WINDOW_END = 23;
const OVERTIME_THRESHOLD_MIN = 5;   // 超过排班时间5分钟算加班
const EARLY_THRESHOLD_MIN = 1;       // 早退1分钟即标记

function isWithinWindow(type: 'CLOCK_IN' | 'CLOCK_OUT', hour: number): boolean {
  if (type === 'CLOCK_IN') return hour >= CLOCK_IN_WINDOW_START && hour < CLOCK_IN_WINDOW_END;
  return hour >= CLOCK_OUT_WINDOW_START && hour <= CLOCK_OUT_WINDOW_END;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

interface CreateRecordParams {
  userId: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  photoBuffer?: Buffer;
  photoOriginalName?: string;
  requesterStoreId?: string | null;
}

export async function createRecord(params: CreateRecordParams) {
  const { userId, type, photoBuffer, photoOriginalName, requesterStoreId } = params;

  if (!photoBuffer) {
    throw new BadRequestError('打卡必须拍照');
  }

  // Verify same store or crossStore
  if (requesterStoreId) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || (targetUser.storeId !== requesterStoreId && !targetUser.crossStore)) {
      throw new BadRequestError('只能为本店员工打卡');
    }
  }

  // Look up today's roster
  const todayStart = beijingDayStart(nowBeijing());
  const todayEnd = beijingDayEnd(nowBeijing());
  const roster = await prisma.roster.findFirst({
    where: { userId, shiftDate: { gte: todayStart, lte: todayEnd } },
  });

  let rosterId: string | null = null;
  let lateMinutes: number | null = null;
  let note: string | null = null;

  // Check if on approved leave today
  let onLeave = false;
  if (roster) {
    const leaveDates = await getApprovedLeaveDates(userId, todayStart, todayEnd);
    onLeave = leaveDates.has(nowBeijing().format('YYYY-MM-DD'));
  }

  const beijingHour = nowBeijing().hour();
  let isAnomalous = false;

  // Count today's existing records to detect midday breaks
  const todayInCount = await prisma.clockRecord.count({
    where: { userId, type: 'CLOCK_IN', createdAt: { gte: todayStart, lte: todayEnd } },
  });
  const todayOutCount = await prisma.clockRecord.count({
    where: { userId, type: 'CLOCK_OUT', createdAt: { gte: todayStart, lte: todayEnd } },
  });

  if (onLeave) {
    isAnomalous = false;
    note = `${roster!.startTime}-${roster!.endTime}, 已请假`;
  } else if (roster && type === 'CLOCK_IN') {
    const now = nowBeijing();
    if (todayInCount >= 1 && roster && roster.breakMinutes > 0) {
      // Returning from midday break (only for full-day employees)
      isAnomalous = false;
      note = `${roster.startTime}-${roster.endTime}, 午休返回`;
    } else if (todayInCount >= 1) {
      // Additional clock-in (not first today, not full-day) — could be coverage/overtime session
      isAnomalous = false;
      note = `${roster.startTime}-${roster.endTime}, 加班时段`;
    } else {
      lateMinutes = calcLateMinutes(roster.startTime, now);
      isAnomalous = lateMinutes > 0;
      note = isAnomalous
        ? `${roster.startTime}-${roster.endTime}, 迟到 ${lateMinutes} 分钟`
        : `${roster.startTime}-${roster.endTime}, 准时`;
    }
  } else if (roster && type === 'CLOCK_OUT') {
    const now = nowBeijing();
    const isFullDay = roster.breakMinutes > 0;
    let effectiveEndTime = roster.endTime;

    // Check for COVERAGE overtime records that extend the effective endTime
    if (!isFullDay) {
      const coverageOts = await prisma.overtimeRecord.findMany({
        where: { userId, date: { gte: todayStart, lte: todayEnd }, type: 'COVERAGE' },
        select: { endTime: true },
      });
      for (const ot of coverageOts) {
        if (ot.endTime > effectiveEndTime) effectiveEndTime = ot.endTime;
      }
    }

    const end = parseTimeToBeijing(now, effectiveEndTime);
    const hoursBeforeEnd = end.diff(now, 'hour', true);

    // 午休检测仅限全天班员工
    if (isFullDay && hoursBeforeEnd > 4) {
      isAnomalous = false;
      note = `${roster.startTime}-${roster.endTime}, 午休`;
    } else {
      const diffMinutes = now.diff(end, 'minute');
      if (diffMinutes > OVERTIME_THRESHOLD_MIN) {
        isAnomalous = false;
        note = `${roster.startTime}-${effectiveEndTime}, 准时下班，加班${formatDuration(diffMinutes)}`;
        // Auto-create voluntary overtime record
        const overtimeHours = Math.round((diffMinutes / 60) * 10) / 10;
        const storeForOT = await prisma.roster.findUnique({ where: { id: roster.id }, select: { storeId: true } });
        if (storeForOT) {
          prisma.overtimeRecord.create({
            data: {
              userId, storeId: storeForOT.storeId,
              date: roster.shiftDate,
              startTime: effectiveEndTime,
              endTime: now.format('HH:mm'),
              hours: overtimeHours,
              type: 'VOLUNTARY',
            },
          }).catch(() => {});
        }
      } else if (diffMinutes <= -EARLY_THRESHOLD_MIN) {
        // 额外检查：实际工作时长是否严重不足才算早退
        // 防止排班被修改后产生误判（如夏淑利/邬灵芝案例）
        const scheduledMinutes = parseTimeToBeijing(now, roster.endTime).diff(
          parseTimeToBeijing(now, roster.startTime), 'minute'
        );
        const workedMinutes = now.diff(
          parseTimeToBeijing(now, roster.startTime), 'minute'
        );
        // 工作时间超过排班的80%不算早退（允许合理时间差）
        if (workedMinutes < scheduledMinutes * 0.8 && diffMinutes <= -10) {
          isAnomalous = true;
          note = `提前 ${formatDuration(Math.abs(diffMinutes))} 下班`;
        } else {
          isAnomalous = false;
          note = `${roster.startTime}-${roster.endTime}, 准时下班`;
        }
      } else {
        isAnomalous = false;
        note = `${roster.startTime}-${effectiveEndTime}, 准时下班`;
      }
    }
  } else {
    // No roster: fall back to time window check
    isAnomalous = !isWithinWindow(type, beijingHour);
  }

  if (roster) {
    rosterId = roster.id;
  }

  const photoKey = await savePhoto(photoBuffer, photoOriginalName || 'photo.jpg');

  const record = await prisma.clockRecord.create({
    data: { userId, type, photoKey, isAnomalous, rosterId, lateMinutes, note },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    ...record,
    createdAt: formatBeijing(record.createdAt),
  };
}

interface QueryRecordsParams {
  userId?: string;
  startDate?: string;
  endDate?: string;
  type?: 'CLOCK_IN' | 'CLOCK_OUT';
  anomalous?: boolean;
  page?: number;
  pageSize?: number;
}

export async function queryRecords(params: QueryRecordsParams, storeId: string | null, _requesterRole?: string) {
  const { userId, startDate, endDate, type, anomalous, page = 1, pageSize = 20 } = params;

  const where: Prisma.ClockRecordWhereInput = {};
  if (storeId) {
    where.user = { storeId };
  }

  if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Prisma.DateTimeFilter).gte = beijingDayStart(dayjs.tz(startDate, 'Asia/Shanghai'));
    }
    if (endDate) {
      (where.createdAt as Prisma.DateTimeFilter).lte = beijingDayEnd(dayjs.tz(endDate, 'Asia/Shanghai'));
    }
  }

  if (type) {
    where.type = type;
  }

  if (anomalous !== undefined) {
    where.isAnomalous = anomalous;
  }

  const [records, total] = await Promise.all([
    prisma.clockRecord.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, store: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.clockRecord.count({ where }),
  ]);

  return {
    records: records.map((r) => ({
      ...r,
      createdAt: formatBeijing(r.createdAt),
      hasPhoto: !!r.photoKey,
      isAnomalous: r.isAnomalous,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getPhotoForRecord(recordId: string, requesterUserId: string, requesterRole: string, requesterStoreId: string | null) {
  const record = await prisma.clockRecord.findUnique({
    where: { id: recordId },
    include: { user: { select: { id: true, storeId: true } } },
  });

  if (!record) throw new NotFoundError('打卡记录不存在');

  const isStoreAdminOfRecord = requesterRole === 'STORE_ADMIN' && requesterStoreId === record.user.storeId;
  if (requesterRole !== 'ADMIN' && record.userId !== requesterUserId && !isStoreAdminOfRecord) {
    throw new NotFoundError('打卡记录不存在');
  }

  if (requesterStoreId && record.user.storeId !== requesterStoreId) {
    throw new NotFoundError('打卡记录不存在');
  }

  if (!record.photoKey) throw new NotFoundError('该记录无照片');

  const buffer = await getPhoto(record.photoKey);
  return buffer;
}

interface CreateManualParams {
  userId: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  note?: string;
  requesterStoreId?: string | null;
}

export async function createManualRecord(params: CreateManualParams) {
  const { userId, type, timestamp, note, requesterStoreId } = params;

  if (requesterStoreId) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new NotFoundError('用户不存在');
    if (targetUser.storeId !== requesterStoreId && !targetUser.crossStore) {
      throw new BadRequestError('只能为本店员工补录');
    }
  }

  const beijingMoment = dayjs.tz(timestamp, 'Asia/Shanghai');
  if (!beijingMoment.isValid()) {
    throw new BadRequestError('时间格式无效');
  }
  const recordTime = beijingMoment.utc().toDate();

  const dayStart = beijingDayStart(beijingMoment);
  const dayEnd = beijingDayEnd(beijingMoment);
  const roster = await prisma.roster.findFirst({
    where: { userId, shiftDate: { gte: dayStart, lte: dayEnd } },
  });

  const defaultNote = `管理员手动补录${note ? ` - ${note}` : ''}`;

  const record = await prisma.clockRecord.create({
    data: {
      userId,
      type,
      photoKey: null,
      isAnomalous: false,
      rosterId: roster?.id ?? null,
      lateMinutes: null,
      note: defaultNote,
      createdAt: recordTime,
    },
    include: {
      user: { select: { id: true, name: true, email: true, store: { select: { id: true, name: true } } } },
    },
  });

  return {
    ...record,
    createdAt: formatBeijing(record.createdAt),
    hasPhoto: false,
  };
}

interface UpdateRecordParams {
  recordId: string;
  type?: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp?: string;
  note?: string;
  requesterStoreId?: string | null;
}

export async function updateRecord(params: UpdateRecordParams) {
  const { recordId, type, timestamp, note, requesterStoreId } = params;

  const record = await prisma.clockRecord.findUnique({
    where: { id: recordId },
    include: { user: { select: { id: true, name: true, email: true, storeId: true, store: { select: { id: true, name: true } } } } },
  });

  if (!record) throw new NotFoundError('打卡记录不存在');

  if (requesterStoreId && record.user.storeId !== requesterStoreId) {
    throw new NotFoundError('打卡记录不存在');
  }

  const updateData: Prisma.ClockRecordUpdateInput = {};

  if (type) {
    updateData.type = type;
  }

  if (timestamp) {
    const beijingMoment = dayjs.tz(timestamp, 'Asia/Shanghai');
    if (!beijingMoment.isValid()) {
      throw new BadRequestError('时间格式无效');
    }
    updateData.createdAt = beijingMoment.utc().toDate();

    const dayStart = beijingDayStart(beijingMoment);
    const dayEnd = beijingDayEnd(beijingMoment);
    const roster = await prisma.roster.findFirst({
      where: { userId: record.userId, shiftDate: { gte: dayStart, lte: dayEnd } },
    });
    updateData.roster = roster ? { connect: { id: roster.id } } : { disconnect: true };
  }

  if (note !== undefined) {
    updateData.note = note;
  }

  const updated = await prisma.clockRecord.update({
    where: { id: recordId },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true, store: { select: { id: true, name: true } } } },
    },
  });

  return {
    ...updated,
    createdAt: formatBeijing(updated.createdAt),
    hasPhoto: !!updated.photoKey,
  };
}

export async function deleteRecord(recordId: string, requesterStoreId: string | null) {
  const record = await prisma.clockRecord.findUnique({
    where: { id: recordId },
    include: { user: { select: { id: true, name: true, storeId: true } } },
  });

  if (!record) throw new NotFoundError('打卡记录不存在');

  if (requesterStoreId && record.user.storeId !== requesterStoreId) {
    throw new NotFoundError('打卡记录不存在');
  }

  // 删除关联的照片文件
  if (record.photoKey) {
    await deletePhoto(record.photoKey);
  }

  await prisma.clockRecord.delete({ where: { id: recordId } });

  return { id: recordId, userName: record.user.name };
}

export async function toggleAnomaly(recordId: string, requesterStoreId: string | null) {
  const record = await prisma.clockRecord.findUnique({
    where: { id: recordId },
    include: { user: { select: { id: true, name: true, email: true, storeId: true, store: { select: { id: true, name: true } } } } },
  });

  if (!record) throw new NotFoundError('打卡记录不存在');

  if (requesterStoreId && record.user.storeId !== requesterStoreId) {
    throw new NotFoundError('打卡记录不存在');
  }

  const updated = await prisma.clockRecord.update({
    where: { id: recordId },
    data: { isAnomalous: !record.isAnomalous },
    include: {
      user: { select: { id: true, name: true, email: true, store: { select: { id: true, name: true } } } },
    },
  });

  return {
    ...updated,
    createdAt: formatBeijing(updated.createdAt),
    hasPhoto: !!updated.photoKey,
  };
}
