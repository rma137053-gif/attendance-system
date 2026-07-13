import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { formatBeijing, toBeijing, beijingDayStart, beijingDayEnd, nowBeijing } from '../utils/timezone';
import { savePhoto, getPhoto, deletePhoto } from './storage.service';
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

  // Check if within valid time window
  const beijingHour = nowBeijing().hour();
  const isAnomalous = !isWithinWindow(type, beijingHour);

  // Dedup: same type same day
  const todayStart = beijingDayStart(nowBeijing());
  const todayEnd = beijingDayEnd(nowBeijing());
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
      duplicate: true,
    };
  }

  if (existingSameType && type === 'CLOCK_OUT') {
    // Keep last clock-out — save new photo first, then replace old record
    const photoKey = await savePhoto(photoBuffer, photoOriginalName || 'photo.jpg');
    if (existingSameType.photoKey) {
      await deletePhoto(existingSameType.photoKey).catch(() => {});
    }
    await prisma.clockRecord.delete({ where: { id: existingSameType.id } });

    const record = await prisma.clockRecord.create({
      data: { userId, type, photoKey, isAnomalous },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ...record,
      createdAt: formatBeijing(record.createdAt),
    };
  }

  const photoKey = await savePhoto(photoBuffer, photoOriginalName || 'photo.jpg');

  const record = await prisma.clockRecord.create({
    data: { userId, type, photoKey, isAnomalous },
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

  // Employees can only view their own photos
  if (requesterRole !== 'ADMIN' && record.userId !== requesterUserId) {
    throw new NotFoundError('打卡记录不存在');
  }

  // Store-scoped admin can only see their store's photos
  if (requesterRole === 'ADMIN' && requesterStoreId && record.user.storeId !== requesterStoreId) {
    throw new NotFoundError('打卡记录不存在');
  }

  if (!record.photoKey) throw new NotFoundError('该记录无照片');

  const buffer = await getPhoto(record.photoKey);
  return buffer;
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
