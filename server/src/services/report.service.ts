import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import { TZ, formatBeijing, toBeijing, beijingWeekStart, beijingWeekEnd, beijingMonthStart, beijingMonthEnd, beijingDayStart, beijingDayEnd } from '../utils/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const prisma = new PrismaClient();

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

interface ReportRow {
  userId: string;
  userName: string;
  userEmail: string;
  storeName: string;
  clockInCount: number;
  clockOutCount: number;
  daysWithRecords: number;
  workHours: string;      // "X小时Y分钟"
  overtime: string;         // total "X小时Y分钟"
  overtimeVoluntary: string; // 主动加班
  overtimeCoverage: string;  // 被动加班
  earlyDeparture: string;   // "X小时Y分钟"
  lateCount: number;
  earlyCount: number;
  missingClockOut: boolean;
  leaveDays: number;
  restDays: number;
}

interface WeeklyReportRow extends ReportRow {
  weekStart: string;
  weekEnd: string;
}

interface MonthlyReportRow extends ReportRow {
  month: string;
}

// Pair clock-ins with clock-outs sequentially, compute per-day stats
function buildUserDayStats(
  records: { userId: string; type: string; createdAt: Date }[],
  rosterMap: Map<string, { endTime: string; startTime: string }>,
) {
  // userDayMap: userId → dateStr → { ins: dayjs[], outs: dayjs[] }
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

  // Per-user per-day stats
  const result = new Map<string, Map<string, { workMin: number; overtimeMin: number; earlyMin: number; lateCount: number; earlyCount: number; missingOut: boolean }>>();

  for (const [userId, dayMap] of userDayMap) {
    const userStats = new Map<string, { workMin: number; overtimeMin: number; earlyMin: number; lateCount: number; earlyCount: number; missingOut: boolean }>();
    result.set(userId, userStats);

    for (const [dateStr, entry] of dayMap) {
      const sortedIns = entry.ins.sort((a, b) => a.valueOf() - b.valueOf());
      const sortedOuts = entry.outs.sort((a, b) => a.valueOf() - b.valueOf());

      let workMin = 0;
      let overtimeMin = 0;
      let earlyMin = 0;
      let lateCount = 0;
      let earlyCount = 0;
      const missingOut = sortedIns.length > sortedOuts.length;

      // Pair sequentially: in[i] with out[i]
      const pairCount = Math.min(sortedIns.length, sortedOuts.length);
      const rosterKey = `${userId}_${dateStr}`;
      const roster = rosterMap.get(rosterKey);
      const endTime = roster?.endTime; // "HH:mm"

      for (let i = 0; i < pairCount; i++) {
        const inTime = sortedIns[i];
        const outTime = sortedOuts[i];
        const segMin = outTime.diff(inTime, 'minute');
        if (segMin > 0) workMin += segMin;

        // Overtime/early: only check against roster if we have one
        // Early departure only counts on LAST segment (i === pairCount - 1)
        if (roster && endTime) {
          const end = inTime.hour(parseInt(endTime.split(':')[0])).minute(parseInt(endTime.split(':')[1])).second(0);
          const diffMin = outTime.diff(end, 'minute');

          if (diffMin > 5) {
            // Overtime on any segment
            overtimeMin += diffMin;
          }

          // Early departure: only on last segment, and only if out < endTime
          if (i === pairCount - 1 && diffMin <= -1) {
            earlyMin += Math.abs(diffMin);
            earlyCount++;
          }

          // Late: check first in against startTime
          if (i === 0 && roster.startTime) {
            const start = inTime.hour(parseInt(roster.startTime.split(':')[0])).minute(parseInt(roster.startTime.split(':')[1])).second(0);
            const lateMin = inTime.diff(start.add(3, 'minute'), 'minute'); // 3-min grace
            if (lateMin > 0) lateCount++;
          }
        }
      }

      // Also count late for any additional unpaired ins
      if (roster && roster.startTime && sortedIns.length > 0) {
        const firstIn = sortedIns[0];
        const start = firstIn.hour(parseInt(roster.startTime.split(':')[0])).minute(parseInt(roster.startTime.split(':')[1])).second(0);
        const lateMin = firstIn.diff(start.add(3, 'minute'), 'minute');
        if (lateMin > 0) lateCount = 1;
      }

      userStats.set(dateStr, { workMin, overtimeMin, earlyMin, lateCount, earlyCount, missingOut });
    }
  }

  return result;
}

async function buildRosterMap(userIds: string[], rangeStart: Date, rangeEnd: Date): Promise<Map<string, { endTime: string; startTime: string }>> {
  const map = new Map<string, { endTime: string; startTime: string }>();
  if (userIds.length === 0) return map;

  const rosters = await prisma.roster.findMany({
    where: {
      userId: { in: userIds },
      shiftDate: { gte: rangeStart, lte: rangeEnd },
    },
    select: { userId: true, shiftDate: true, startTime: true, endTime: true },
  });

  for (const r of rosters) {
    const dateStr = dayjs.utc(r.shiftDate).tz(TZ).format('YYYY-MM-DD');
    map.set(`${r.userId}_${dateStr}`, { endTime: r.endTime, startTime: r.startTime });
  }

  return map;
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

function computeRow(
  userId: string, userName: string, userEmail: string, storeName: string,
  dayStats: Map<string, { workMin: number; overtimeMin: number; earlyMin: number; lateCount: number; earlyCount: number; missingOut: boolean }>,
  leaveDays: number,
  restDays: number,
  otVoluntaryMin: number,
  otCoverageMin: number,
): ReportRow {
  let clockInCount = 0, clockOutCount = 0, workMin = 0, overtimeMin = 0, earlyMin = 0, lateCount = 0, earlyCount = 0, missingClockOut = false;
  for (const [, stats] of dayStats) {
    clockInCount++; clockOutCount++;
    workMin += stats.workMin; overtimeMin += stats.overtimeMin; earlyMin += stats.earlyMin;
    lateCount += stats.lateCount; earlyCount += stats.earlyCount;
    if (stats.missingOut) missingClockOut = true;
  }
  return {
    userId, userName, userEmail, storeName,
    clockInCount, clockOutCount, daysWithRecords: dayStats.size,
    workHours: formatDuration(workMin),
    overtime: formatDuration(overtimeMin),
    overtimeVoluntary: formatDuration(otVoluntaryMin),
    overtimeCoverage: formatDuration(otCoverageMin),
    earlyDeparture: formatDuration(earlyMin),
    lateCount, earlyCount, missingClockOut, leaveDays, restDays,
  };
}

async function buildOvertimeMap(userIds: string[], rangeStart: Date, rangeEnd: Date) {
  const volMap = new Map<string, number>();
  const covMap = new Map<string, number>();
  if (userIds.length === 0) return { volMap, covMap };
  const records = await prisma.overtimeRecord.findMany({
    where: { userId: { in: userIds }, date: { gte: rangeStart, lte: rangeEnd } },
    select: { userId: true, hours: true, type: true, date: true },
  });
  // 收集所有有被动加班(COVERAGE)的日期，避免同日主动加班重复计算
  const coverageDays = new Set<string>();
  for (const r of records) {
    if (r.type === 'COVERAGE') {
      coverageDays.add(`${r.userId}_${r.date.getTime()}`);
    }
  }
  for (const r of records) {
    const h = Math.round(r.hours * 60); // convert to minutes
    if (r.type === 'COVERAGE') {
      covMap.set(r.userId, (covMap.get(r.userId) || 0) + h);
    } else if (h >= 60) { // 主动加班 ≥ 1 小时才起算
      // 同天已有被动加班 → 跳过，避免双重计算
      if (!coverageDays.has(`${r.userId}_${r.date.getTime()}`)) {
        volMap.set(r.userId, (volMap.get(r.userId) || 0) + h);
      }
    }
  }
  return { volMap, covMap };
}

export async function getWeeklyReport(storeId: string | null, dateStr?: string) {
  const refDate = dateStr ? dayjs.tz(dateStr, TZ) : dayjs().tz(TZ);
  const weekStart = beijingWeekStart(refDate);
  const weekEnd = beijingWeekEnd(refDate);

  const userWhere: any = { status: 'ACTIVE', role: 'EMPLOYEE' };
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

  const userIds = users.map((u) => u.id);
  const rosterMap = await buildRosterMap(userIds, weekStart, weekEnd);
  const leaveMap = await buildLeaveDayMap(userIds, weekStart, weekEnd);
  const userDayStats = buildUserDayStats(records, rosterMap);
  const { volMap, covMap } = await buildOvertimeMap(userIds, weekStart, weekEnd);

  return users.map((u) => {
    const dayStats = userDayStats.get(u.id) || new Map();
    return {
      ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayStats, leaveMap.get(u.id) || 0, 0, volMap.get(u.id) || 0, covMap.get(u.id) || 0),
      weekStart: formatBeijing(weekStart),
      weekEnd: formatBeijing(weekEnd),
    };
  });
}

export async function getMonthlyReport(storeId: string | null, monthStr?: string) {
  const refDate = monthStr ? dayjs.tz(monthStr, TZ) : dayjs().tz(TZ);
  const monthStart = beijingMonthStart(refDate);
  const monthEnd = beijingMonthEnd(refDate);

  const userWhere: any = { status: 'ACTIVE', role: 'EMPLOYEE' };
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

  const userIds = users.map((u) => u.id);
  const [rosterMap, leaveMap, otMaps, restCountMap] = await Promise.all([
    buildRosterMap(userIds, monthStart, monthEnd),
    buildLeaveDayMap(userIds, monthStart, monthEnd),
    buildOvertimeMap(userIds, monthStart, monthEnd),
    prisma.weeklyRest.findMany({
      where: { userId: { in: userIds }, restDate: { gte: monthStart, lte: monthEnd } },
      select: { userId: true },
    }),
  ]);

  const userRestCount = new Map<string, number>();
  for (const r of restCountMap) {
    userRestCount.set(r.userId, (userRestCount.get(r.userId) || 0) + 1);
  }

  const userDayStats = buildUserDayStats(records, rosterMap);

  const rows = users.map((u) => {
    const dayStats = userDayStats.get(u.id) || new Map();
    return {
      ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayStats, leaveMap.get(u.id) || 0, userRestCount.get(u.id) || 0, otMaps.volMap.get(u.id) || 0, otMaps.covMap.get(u.id) || 0),
      month: refDate.format('YYYY-MM'),
    };
  });

  const summary = generateSummary(rows as any);
  return { rows, summary };
}

export async function getYearlyReport(storeId: string | null, yearStr?: string) {
  const yearNum = yearStr ? parseInt(yearStr) : dayjs().tz(TZ).year();
  const yearStart = dayjs.tz(`${yearNum}-01-01`, TZ).startOf('year').utc().toDate();
  const yearEnd = dayjs.tz(`${yearNum}-12-31`, TZ).endOf('year').utc().toDate();

  const userWhere: any = { status: 'ACTIVE', role: 'EMPLOYEE' };
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

  const userIds = users.map((u) => u.id);
  const rosterMap = await buildRosterMap(userIds, yearStart, yearEnd);
  const leaveMap = await buildLeaveDayMap(userIds, yearStart, yearEnd);
  const userDayStats = buildUserDayStats(records, rosterMap);
  const otMaps = await buildOvertimeMap(userIds, yearStart, yearEnd);

  return users.map((u) => {
    const dayStats = userDayStats.get(u.id) || new Map();
    return {
      ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayStats, leaveMap.get(u.id) || 0, 0, otMaps.volMap.get(u.id) || 0, otMaps.covMap.get(u.id) || 0),
      year: `${yearNum}`,
    };
  });
}

export function generateSummary(rows: ReportRow[]): ReportRow & { userName: string } {
  let clockInCount = 0, clockOutCount = 0, daysWithRecords = 0, workMin = 0, overtimeMin = 0, otVolMin = 0, otCovMin = 0, earlyMin = 0;
  let lateCount = 0, earlyCount = 0, anyMissing = false;
  function parseMin(s: string): number { let t = 0; const h = s.match(/(\d+)小时/); const m = s.match(/(\d+)分钟/); if (h) t += parseInt(h[1])*60; if (m) t += parseInt(m[1]); return t; }
  for (const r of rows) {
    clockInCount += r.clockInCount; clockOutCount += r.clockOutCount; daysWithRecords += r.daysWithRecords;
    workMin += parseMin(r.workHours); overtimeMin += parseMin(r.overtime); earlyMin += parseMin(r.earlyDeparture);
    otVolMin += parseMin(r.overtimeVoluntary); otCovMin += parseMin(r.overtimeCoverage);
    lateCount += r.lateCount; earlyCount += r.earlyCount;
    if (r.missingClockOut) anyMissing = true;
  }
  return {
    userId: '', userName: '合计', userEmail: `${rows.length} 人`, storeName: '',
    clockInCount, clockOutCount, daysWithRecords,
    workHours: formatDuration(workMin), overtime: formatDuration(overtimeMin),
    overtimeVoluntary: formatDuration(otVolMin), overtimeCoverage: formatDuration(otCovMin),
    earlyDeparture: formatDuration(earlyMin), lateCount, earlyCount,
    missingClockOut: anyMissing, leaveDays: rows.reduce((sum, r) => sum + (r.leaveDays || 0), 0),
    restDays: rows.reduce((sum, r) => sum + (r.restDays || 0), 0),
  };
}

export async function getUserDailyDetail(userId: string, monthStr: string) {
  const refDate = dayjs.tz(monthStr, TZ);
  const monthStart = beijingDayStart(refDate.startOf('month'));
  const monthEnd = beijingDayEnd(refDate.endOf('month'));

  const [records, rosters, leaves, rests] = await Promise.all([
    prisma.clockRecord.findMany({
      where: { userId, createdAt: { gte: monthStart, lte: monthEnd } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, type: true },
    }),
    prisma.roster.findMany({
      where: { userId, shiftDate: { gte: monthStart, lte: monthEnd } },
      select: { shiftDate: true, startTime: true, endTime: true },
    }),
    prisma.leave.findMany({
      where: { userId, status: 'APPROVED', startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
      select: { startDate: true, endDate: true },
    }),
    prisma.weeklyRest.findMany({
      where: { userId, restDate: { gte: monthStart, lte: monthEnd } },
      select: { restDate: true },
    }),
  ]);

  const rosterByDay = new Map<string, { startTime: string; endTime: string }>();
  for (const r of rosters) {
    rosterByDay.set(toBeijing(r.shiftDate).format('YYYY-MM-DD'), { startTime: r.startTime, endTime: r.endTime });
  }

  const leaveSet = new Set<string>();
  for (const l of leaves) {
    let d = toBeijing(l.startDate);
    const end = toBeijing(l.endDate);
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      leaveSet.add(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  }

  const restSet = new Set<string>();
  for (const r of rests) {
    restSet.add(toBeijing(r.restDate).format('YYYY-MM-DD'));
  }

  // Build daily data
  const daysInMonth = refDate.daysInMonth();
  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = refDate.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const roster = rosterByDay.get(dateStr) || null;
    const dayRecords = records.filter((r) => toBeijing(r.createdAt).format('YYYY-MM-DD') === dateStr);
    const ins = dayRecords.filter((r) => r.type === 'CLOCK_IN').map((r) => toBeijing(r.createdAt).format('HH:mm'));
    const outs = dayRecords.filter((r) => r.type === 'CLOCK_OUT').map((r) => toBeijing(r.createdAt).format('HH:mm'));
    const isLeave = leaveSet.has(dateStr);
    const isRest = restSet.has(dateStr);

    result.push({ date: dateStr, dow: date.day(), roster, ins, outs, isLeave, isRest });
  }

  return result;
}

export function generateCsv(rows: any[]): string {
  if (rows.length === 0) return '';

  const summary = generateSummary(rows);
  const allRows = [...rows, summary as any];

  const headers = ['姓名', '邮箱', '门店', '上班次数', '下班次数', '出勤天数', '请假天数', '实际工时', '主动加班', '被动加班', '早退总计', '迟到次数', '早退次数', '缺下班卡'];
  const lines = [headers.join(',')];

  for (const row of allRows) {
    const values = [
      row.userName || '', row.userEmail || '', (row as any).storeName || '',
      String(row.clockInCount), String(row.clockOutCount), String(row.daysWithRecords),
      String(row.leaveDays ?? 0),
      row.workHours ?? '0', row.overtimeVoluntary ?? '0', row.overtimeCoverage ?? '0', row.earlyDeparture ?? '0',
      String(row.lateCount ?? ''), String(row.earlyCount ?? ''),
      row.missingClockOut ? '是' : '否',
    ];
    lines.push(values.map((v) => (String(v).includes(',') ? `"${v}"` : v)).join(','));
  }

  return lines.join('\n');
}
