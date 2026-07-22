import { PrismaClient } from '@prisma/client';
import { nowBeijing, beijingDayStart, beijingDayEnd, toBeijing, TZ } from '../utils/timezone';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export async function getTodayStats(storeId: string | null) {
  const today = nowBeijing();
  const dayStart = beijingDayStart(today);
  const dayEnd = beijingDayEnd(today);

  // 只查询今日有排班的员工
  const rosterWhere: any = { shiftDate: { gte: dayStart, lte: dayEnd } };
  if (storeId) rosterWhere.storeId = storeId;

  const todayRosters = await prisma.roster.findMany({
    where: rosterWhere,
    select: { userId: true },
  });
  const rosteredUserIds = [...new Set(todayRosters.map((r) => r.userId))];

  // 今日无人排班
  if (rosteredUserIds.length === 0) {
    return {
      date: today.format('YYYY-MM-DD'),
      totalEmployees: 0,
      clockedInCount: 0,
      notClockedInCount: 0,
      clockedOutCount: 0,
      missingClockOutCount: 0,
      clockedIn: [],
      notClockedIn: [],
      missingClockOut: [],
    };
  }

  const [rosteredUsers, todayRecords] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: rosteredUserIds }, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, store: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.clockRecord.findMany({
      where: {
        userId: { in: rosteredUserIds },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { userId: true, type: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const userRecordMap = new Map<string, { clockIns: Date[]; clockOuts: Date[] }>();

  for (const r of todayRecords) {
    if (!userRecordMap.has(r.userId)) {
      userRecordMap.set(r.userId, { clockIns: [], clockOuts: [] });
    }
    const entry = userRecordMap.get(r.userId)!;
    if (r.type === 'CLOCK_IN') entry.clockIns.push(r.createdAt);
    else entry.clockOuts.push(r.createdAt);
  }

  const clockedIn: { id: string; name: string; email: string; storeName: string; firstIn: string; lastOut: string | null }[] = [];
  const notClockedIn: { id: string; name: string; email: string; storeName: string }[] = [];
  const missingClockOut: { id: string; name: string; email: string; storeName: string }[] = [];

  for (const u of rosteredUsers) {
    const storeName = (u as any).store?.name ?? '';
    const entry = userRecordMap.get(u.id);
    if (!entry || entry.clockIns.length === 0) {
      notClockedIn.push({ id: u.id, name: u.name, email: u.email, storeName });
    } else {
      const firstIn = entry.clockIns[0];
      const lastOut = entry.clockOuts.length > 0 ? entry.clockOuts[entry.clockOuts.length - 1] : null;
      clockedIn.push({
        id: u.id,
        name: u.name,
        email: u.email,
        storeName,
        firstIn: toBeijing(firstIn).format('HH:mm:ss'),
        lastOut: lastOut ? toBeijing(lastOut).format('HH:mm:ss') : null,
      });
      if (!lastOut) {
        missingClockOut.push({ id: u.id, name: u.name, email: u.email, storeName });
      }
    }
  }

  return {
    date: today.format('YYYY-MM-DD'),
    totalEmployees: rosteredUsers.length,
    clockedInCount: clockedIn.length,
    notClockedInCount: notClockedIn.length,
    clockedOutCount: clockedIn.filter((c) => c.lastOut).length,
    missingClockOutCount: missingClockOut.length,
    clockedIn,
    notClockedIn,
    missingClockOut,
  };
}
