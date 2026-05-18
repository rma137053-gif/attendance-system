import { PrismaClient } from '@prisma/client';
import { nowBeijing, beijingDayStart, beijingDayEnd } from '../utils/timezone';
import { parseTimeToBeijing, isShiftEndNear } from '../utils/roster';
import { GRACE_MINUTES } from '../constants/shifts';
import { sendPush } from '../services/push.service';

const prisma = new PrismaClient();

export async function runReminderCheck() {
  const now = nowBeijing();
  const todayStart = beijingDayStart(now);
  const todayEnd = beijingDayEnd(now);

  // Get all rosters for today
  const rosters = await prisma.roster.findMany({
    where: {
      shiftDate: { gte: todayStart, lte: todayEnd },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  // 过滤已审批请假的用户，避免向请假人员发送打卡提醒
  const rosterUserIds = [...new Set(rosters.map((r) => r.userId))];
  let leaveUserIds = new Set<string>();
  if (rosterUserIds.length > 0) {
    const approvedLeaves = await prisma.leave.findMany({
      where: {
        userId: { in: rosterUserIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: { userId: true },
    });
    leaveUserIds = new Set(approvedLeaves.map((l) => l.userId));
  }

  // 过滤已选休息日的员工
  let restUserIds = new Set<string>();
  if (rosterUserIds.length > 0) {
    const todayRests = await prisma.weeklyRest.findMany({
      where: {
        userId: { in: rosterUserIds },
        restDate: { gte: todayStart, lte: todayEnd },
      },
      select: { userId: true },
    });
    restUserIds = new Set(todayRests.map((r) => r.userId));
  }

  for (const roster of rosters) {
    if (leaveUserIds.has(roster.userId)) continue;
    if (restUserIds.has(roster.userId)) continue;
    const shiftStart = parseTimeToBeijing(now, roster.startTime);
    const shiftEnd = parseTimeToBeijing(now, roster.endTime);

    // 1. 提前5分钟内提醒上班打卡
    const minutesUntilStart = shiftStart.diff(now, 'minute');
    if (minutesUntilStart > 0 && minutesUntilStart <= 5) {
      await sendReminderIfNeeded(roster, todayStart, todayEnd, 'CLOCK_IN_REMINDER',
        `班次即将开始`,
        `${roster.user.name}，你的班次(${roster.startTime}-${roster.endTime})还有${minutesUntilStart}分钟开始，请准备打卡`,
      );
    }

    // 2. 宽限期过后催促（刚过宽限期的1分钟内）
    const minutesPastGrace = now.diff(shiftStart, 'minute') - GRACE_MINUTES;
    if (minutesPastGrace >= 0 && minutesPastGrace <= 1) {
      await sendReminderIfNeeded(roster, todayStart, todayEnd, 'CLOCK_IN_URGE',
        `请尽快打卡`,
        `${roster.user.name}，你的班次(${roster.startTime}-${roster.endTime})已在${GRACE_MINUTES}分钟前开始，系统将标记为迟到`,
      );
    }

    // 3. 下班前5分钟提醒
    if (isShiftEndNear(roster.endTime, now, 5)) {
      await sendReminderIfNeeded(roster, todayStart, todayEnd, 'CLOCK_OUT_REMINDER',
        `班次即将结束`,
        `${roster.user.name}，你的班次(${roster.startTime}-${roster.endTime})将于${roster.endTime}结束，请准备下班打卡`,
      );
    }
  }
}

async function sendReminderIfNeeded(
  roster: { id: string; userId: string; user: { id: string; name: string } },
  todayStart: Date,
  todayEnd: Date,
  pushType: 'CLOCK_IN_REMINDER' | 'CLOCK_IN_URGE' | 'CLOCK_OUT_REMINDER',
  title: string,
  body: string,
) {
  // Check if already has a clock record
  const existingRecord =
    pushType === 'CLOCK_OUT_REMINDER'
      ? await prisma.clockRecord.findFirst({
          where: {
            userId: roster.userId,
            type: 'CLOCK_OUT',
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        })
      : await prisma.clockRecord.findFirst({
          where: {
            userId: roster.userId,
            type: 'CLOCK_IN',
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        });

  if (existingRecord) return;

  await sendPush({
    userId: roster.userId,
    title,
    body,
    type: pushType,
    rosterId: roster.id,
  });
}
