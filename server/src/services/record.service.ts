import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { formatBeijing, toBeijing, beijingDayStart, beijingDayEnd, nowBeijing } from '../utils/timezone';
import { calcLateMinutes, parseTimeToBeijing } from '../utils/roster';
import { savePhoto, getPhoto, deletePhoto } from './storage.service';
import { getApprovedLeaveDates } from './leave.service';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const CLOCK_IN_WINDOW_START = 5;  // 05:00 Beijing
const CLOCK_IN_WINDOW_END = 23;   // 23:00 Beijing (exclusive)
const CLOCK_OUT_WINDOW_START = 12; // 12:00 Beijing
const CLOCK_OUT_WINDOW_END = 23;   // 23:59 Beijing

function isWithinWindow(type: 'CLOCK_IN' | 'CLOCK_OUT', hour: number): boolean {
  if (type === 'CLOCK_IN') return hour >= CLOCK_IN_WINDOW_START && hour < CLOCK_IN_WINDOW_END;
  return hour >= CLOCK_OUT_WINDOW_START && hour <= CLOCK_OUT_WINDOW_END;
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

  // If a store-scoped user is clocking on behalf of someone, verify same store
  if (requesterStoreId) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.storeId !== requesterStoreId) {
      throw new BadRequestError('只能为本店员工打卡');
    }
  }

  // Look up today's roster for roster linkage
  const todayStart = beijingDayStart(nowBeijing());
  const todayEnd = beijingDayEnd(nowBeijing());
  const roster = await prisma.roster.findFirst({
    where: {
      userId,
      shiftDate: { gte: todayStart, lte: todayEnd },
    },
  });

  let rosterId: string | null = null;
  let lateMinutes: number | null = null;
  let note: string | null = null;

  // Check if user is on approved leave today
  let onLeave = false;
  if (roster) {
    const leaveDates = await getApprovedLeaveDates(userId, todayStart, todayEnd);
    onLeave = leaveDates.has(nowBeijing().format('YYYY-MM-DD'));
  }

  // Check if within valid time window
  const beijingHour = nowBeijing().hour();

  // With roster: use roster-based anomaly detection instead of time window
  let isAnomalous: boolean;
  if (onLeave) {
    // 已审批请假：不标记异常
    isAnomalous = false;
    note = `${roster!.startTime}-${roster!.endTime}, 已请假`;
  } else if (roster && type === 'CLOCK_IN') {
    const now = nowBeijing();
    lateMinutes = calcLateMinutes(roster.startTime, now);
    isAnomalous = lateMinutes > 0;
    note = isAnomalous
      ? `${roster.startTime}-${roster.endTime}, 迟到 ${lateMinutes} 分钟`
      : `${roster.startTime}-${roster.endTime}, 准时`;
  } else if (roster && type === 'CLOCK_OUT') {
    const now = nowBeijing();
    const end = parseTimeToBeijing(now, roster.endTime);
    if (now.isBefore(end)) {
      const earlyMinutes = end.diff(now, 'minute');
      isAnomalous = true;
      note = `提前 ${earlyMinutes} 分钟下班`;
    } else {
      isAnomalous = false;
      note = `${roster.startTime}-${roster.endTime}, 准时下班`;
    }
  } else {
    // No roster: fall back to existing time window check
    isAnomalous = !isWithinWindow(type, beijingHour);
  }

  if (roster) {
    rosterId = roster.id;
  }

  // Dedup: same type same day
  const existingSameType = await prisma.clockRecord.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: todayStart, lte: todayEnd },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existingSameType && type === 'CLOCK_IN') {
    // Keep first clock-in — return existing, fetch user for response
    const clockUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    return {
      ...existingSameType,
      createdAt: formatBeijing(existingSameType.createdAt),
      user: clockUser ?? { id: userId, name: '', email: '' },
      rosterId: existingSameType.rosterId,
      lateMinutes: existingSameType.lateMinutes,
      note: existingSameType.note,
      duplicate: true,
    };
  }

  if (existingSameType && type === 'CLOCK_OUT') {
    // Keep last clock-out — save new photo first, then replace old record atomically
    const photoKey = await savePhoto(photoBuffer, photoOriginalName || 'photo.jpg');
    if (existingSameType.photoKey) {
      await deletePhoto(existingSameType.photoKey).catch(() => {});
    }

    const [record] = await prisma.$transaction([
      prisma.clockRecord.create({
        data: { userId, type, photoKey, isAnomalous, rosterId, lateMinutes, note },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.clockRecord.delete({ where: { id: existingSameType.id } }),
    ]);

    return {
      ...record,
      createdAt: formatBeijing(record.createdAt),
    };
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

  // Employees can only view their own photos; STORE_ADMIN can view their store's employees
  const isStoreAdminOfRecord = requesterRole === 'STORE_ADMIN' && requesterStoreId === record.user.storeId;
  if (requesterRole !== 'ADMIN' && record.userId !== requesterUserId && !isStoreAdminOfRecord) {
    throw new NotFoundError('打卡记录不存在');
  }

  // Store-scoped admin can only see their store's photos
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

  // Store-scoped admin can only create for their store
  if (requesterStoreId) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new NotFoundError('用户不存在');
    if (targetUser.storeId !== requesterStoreId) {
      throw new BadRequestError('只能为本店员工补录');
    }
  }

  // Parse the admin-specified Beijing time
  const beijingMoment = dayjs.tz(timestamp, 'Asia/Shanghai');
  if (!beijingMoment.isValid()) {
    throw new BadRequestError('时间格式无效');
  }
  const recordTime = beijingMoment.utc().toDate();

  // Look up roster for the given date
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

    // Re-link roster based on new date
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

export async function toggleAnomaly(recordId: string, requesterStoreId: string | null) {
  const record = await prisma.clockRecord.findUnique({
    where: { id: recordId },
    include: { user: { select: { id: true, name: true, email: true, storeId: true, store: { select: { id: true, name: true } } } } },
  });

  if (!record) throw new NotFoundError('打卡记录不存在');

  // Global admin can toggle any; store-scoped admin can only toggle their store
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
