import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import { TZ, formatBeijing, toBeijing, beijingWeekStart, beijingWeekEnd, beijingMonthStart, beijingMonthEnd } from '../utils/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const prisma = new PrismaClient();

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;

interface ReportRow {
  userId: string;
  userName: string;
  userEmail: string;
  storeName: string;
  clockInCount: number;
  clockOutCount: number;
  daysWithRecords: number;
  totalHours: number;
  lateCount: number;
  earlyCount: number;
  missingClockOut: boolean;
  leaveDays: number;
}

interface WeeklyReportRow extends ReportRow {
  weekStart: string;
  weekEnd: string;
}

interface MonthlyReportRow extends ReportRow {
  month: string;
}

interface YearlyReportRow extends ReportRow {
  year: string;
}

function buildUserDayMap(records: { userId: string; type: string; createdAt: Date }[]) {
  const userDayMap = new Map<string, Map<string, { ins: dayjs.Dayjs[]; outs: dayjs.Dayjs[] }>>();

  for (const r of records) {
    if (!userDayMap.has(r.userId)) {
      userDayMap.set(r.userId, new Map());
    }
    const dayMap = userDayMap.get(r.userId)!;
    const dayKey = dayjs.utc(r.createdAt).tz(TZ).format('YYYY-MM-DD');
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { ins: [], outs: [] });
    }
    const entry = dayMap.get(dayKey)!;
    if (r.type === 'CLOCK_IN') {
      entry.ins.push(toBeijing(r.createdAt));
    } else {
      entry.outs.push(toBeijing(r.createdAt));
    }
  }

  return userDayMap;
}

function computeDailyHours(entry: { ins: dayjs.Dayjs[]; outs: dayjs.Dayjs[] }): number {
  if (entry.ins.length === 0 || entry.outs.length === 0) return 0;
  const firstIn = entry.ins.sort((a, b) => a.valueOf() - b.valueOf())[0];
  const lastOut = entry.outs.sort((a, b) => b.valueOf() - a.valueOf())[0];
  const diffMinutes = lastOut.diff(firstIn, 'minute');
  if (diffMinutes <= 0) return 0;
  return Math.round((diffMinutes / 60) * 10) / 10; // round to 1 decimal
}

async function buildLeaveDayMap(userIds: string[], rangeStart: Date, rangeEnd: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;

  const leaves = await prisma.leave.findMany({
    where: {
      userId: { in: userIds },
      status: 'APPROVED',
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
    },
    select: { userId: true, startDate: true, endDate: true },
  });

  for (const l of leaves) {
    let d = dayjs.utc(l.startDate).tz(TZ);
    const end = dayjs.utc(l.endDate).tz(TZ);
    const rStart = dayjs.utc(rangeStart).tz(TZ);
    const rEnd = dayjs.utc(rangeEnd).tz(TZ);
    // Clamp to report range
    if (d.isBefore(rStart)) d = rStart;
    const effectiveEnd = end.isAfter(rEnd) ? rEnd : end;
    let count = 0;
    while (d.isBefore(effectiveEnd) || d.isSame(effectiveEnd, 'day')) {
      count++;
      d = d.add(1, 'day');
    }
    map.set(l.userId, (map.get(l.userId) || 0) + count);
  }

  return map;
}

function computeRow(userId: string, userName: string, userEmail: string, storeName: string, dayMap: Map<string, { ins: dayjs.Dayjs[]; outs: dayjs.Dayjs[] }>, leaveDays: number): ReportRow {
  let clockInCount = 0;
  let clockOutCount = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let totalMinutes = 0;
  const daysWithRecords = dayMap.size;
  let missingClockOut = false;

  for (const [, entry] of dayMap) {
    clockInCount += entry.ins.length;
    clockOutCount += entry.outs.length;

    if (entry.ins.length > 0 && entry.outs.length === 0) {
      missingClockOut = true;
    }

    // Daily hours: first-in to last-out
    if (entry.ins.length > 0 && entry.outs.length > 0) {
      const firstIn = entry.ins.sort((a, b) => a.valueOf() - b.valueOf())[0];
      const lastOut = entry.outs.sort((a, b) => b.valueOf() - a.valueOf())[0];
      const diff = lastOut.diff(firstIn, 'minute');
      if (diff > 0) totalMinutes += diff;
    }

    // Late
    if (entry.ins.length > 0) {
      const firstIn = entry.ins.sort((a, b) => a.valueOf() - b.valueOf())[0];
      if (firstIn.hour() >= WORK_START_HOUR && (firstIn.hour() > WORK_START_HOUR || firstIn.minute() > 0)) {
        lateCount++;
      }
    }

    // Early
    if (entry.outs.length > 0) {
      const lastOut = entry.outs.sort((a, b) => b.valueOf() - a.valueOf())[0];
      if (lastOut.hour() < WORK_END_HOUR) {
        earlyCount++;
      }
    }
  }

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  return {
    userId,
    userName,
    userEmail,
    storeName,
    clockInCount,
    clockOutCount,
    daysWithRecords,
    totalHours,
    lateCount,
    earlyCount,
    missingClockOut,
    leaveDays,
  };
}

export async function getWeeklyReport(storeId: string | null, dateStr?: string) {
  const refDate = dateStr ? dayjs.tz(dateStr, TZ) : dayjs().tz(TZ);
  const weekStart = beijingWeekStart(refDate);
  const weekEnd = beijingWeekEnd(refDate);

  const userWhere: any = { status: 'ACTIVE' };
  if (storeId) userWhere.storeId = storeId;

  const [users, records] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, store: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.clockRecord.findMany({
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const userDayMap = buildUserDayMap(records);

  // 统计已审批请假天数
  const leaveMap = await buildLeaveDayMap(users.map((u) => u.id), weekStart, weekEnd);

  return users.map((u) => {
    const dayMap = userDayMap.get(u.id) || new Map();
    return {
      ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayMap, leaveMap.get(u.id) || 0),
      weekStart: formatBeijing(weekStart),
      weekEnd: formatBeijing(weekEnd),
    };
  });
}

export async function getMonthlyReport(storeId: string | null, monthStr?: string) {
  const refDate = monthStr ? dayjs.tz(monthStr, TZ) : dayjs().tz(TZ);
  const monthStart = beijingMonthStart(refDate);
  const monthEnd = beijingMonthEnd(refDate);

  const userWhere: any = { status: 'ACTIVE' };
  if (storeId) userWhere.storeId = storeId;

  const [users, records] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, store: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.clockRecord.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const userDayMap = buildUserDayMap(records);

  const leaveMap = await buildLeaveDayMap(users.map((u) => u.id), monthStart, monthEnd);

  return users.map((u) => {
    const dayMap = userDayMap.get(u.id) || new Map();
    return {
      ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayMap, leaveMap.get(u.id) || 0),
      month: refDate.format('YYYY-MM'),
    };
  });
}

export async function getYearlyReport(storeId: string | null, yearStr?: string) {
  const year = yearStr ? parseInt(yearStr) : dayjs().tz(TZ).year();
  const yearStart = dayjs.tz(`${year}-01-01`, TZ).startOf('year').utc().toDate();
  const yearEnd = dayjs.tz(`${year}-12-31`, TZ).endOf('year').utc().toDate();

  const userWhere: any = { status: 'ACTIVE' };
  if (storeId) userWhere.storeId = storeId;

  const [users, records] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, store: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.clockRecord.findMany({
      where: { createdAt: { gte: yearStart, lte: yearEnd } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const userDayMap = buildUserDayMap(records);

  const leaveMap = await buildLeaveDayMap(users.map((u) => u.id), yearStart, yearEnd);

  return users.map((u) => {
    const dayMap = userDayMap.get(u.id) || new Map();
    return {
      ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayMap, leaveMap.get(u.id) || 0),
      year: `${year}`,
    };
  });
}

export function generateSummary(rows: ReportRow[]): ReportRow & { userName: string } {
  let clockInCount = 0;
  let clockOutCount = 0;
  let daysWithRecords = 0;
  let totalHours = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let anyMissing = false;

  for (const r of rows) {
    clockInCount += r.clockInCount;
    clockOutCount += r.clockOutCount;
    totalHours += r.totalHours;
    lateCount += r.lateCount;
    earlyCount += r.earlyCount;
    if (r.missingClockOut) anyMissing = true;
  }

  daysWithRecords = rows.reduce((sum, r) => sum + r.daysWithRecords, 0);
  totalHours = Math.round(totalHours * 10) / 10;

  return {
    userId: '',
    userName: '合计',
    userEmail: `${rows.length} 人`,
    storeName: '',
    clockInCount,
    clockOutCount,
    daysWithRecords,
    totalHours,
    lateCount,
    earlyCount,
    missingClockOut: anyMissing,
    leaveDays: rows.reduce((sum, r) => sum + (r.leaveDays || 0), 0),
  };
}

export function generateCsv(rows: (WeeklyReportRow | MonthlyReportRow | YearlyReportRow)[]): string {
  if (rows.length === 0) return '';

  const summary = generateSummary(rows);
  const allRows = [...rows, summary as any];

  const headers = ['姓名', '邮箱', '门店', '上班次数', '下班次数', '出勤天数', '请假天数', '总工时(h)', '迟到次数', '早退次数', '缺下班卡'];
  const lines = [headers.join(',')];

  for (const row of allRows) {
    const values = [
      row.userName || '',
      row.userEmail || '',
      (row as any).storeName || '',
      String(row.clockInCount),
      String(row.clockOutCount),
      String(row.daysWithRecords),
      String(row.leaveDays ?? 0),
      String(row.totalHours ?? '0'),
      String(row.lateCount ?? ''),
      String(row.earlyCount ?? ''),
      row.missingClockOut ? '是' : '否',
    ];
    lines.push(values.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
  }

  return lines.join('\n');
}
