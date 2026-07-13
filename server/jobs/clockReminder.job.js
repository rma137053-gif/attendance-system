"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReminderCheck = runReminderCheck;
const client_1 = require("@prisma/client");
const timezone_1 = require("../utils/timezone");
const roster_1 = require("../utils/roster");
const shifts_1 = require("../constants/shifts");
const push_service_1 = require("../services/push.service");
const prisma = new client_1.PrismaClient();
async function runReminderCheck() {
    const now = (0, timezone_1.nowBeijing)();
    const todayStart = (0, timezone_1.beijingDayStart)(now);
    const todayEnd = (0, timezone_1.beijingDayEnd)(now);
    // Get all rosters for today
    const rosters = await prisma.roster.findMany({
        where: {
            shiftDate: { gte: todayStart, lte: todayEnd },
        },
        include: {
            user: { select: { id: true, name: true } },
        },
    });
    for (const roster of rosters) {
        const shiftStart = (0, roster_1.parseTimeToBeijing)(now, roster.startTime);
        const shiftEnd = (0, roster_1.parseTimeToBeijing)(now, roster.endTime);
        // 1. 提前5分钟内提醒上班打卡
        const minutesUntilStart = shiftStart.diff(now, 'minute');
        if (minutesUntilStart > 0 && minutesUntilStart <= 5) {
            await sendReminderIfNeeded(roster, todayStart, todayEnd, 'CLOCK_IN_REMINDER', `班次即将开始`, `${roster.user.name}，你的班次(${roster.startTime}-${roster.endTime})还有${minutesUntilStart}分钟开始，请准备打卡`);
        }
        // 2. 宽限期过后催促（刚过宽限期的1分钟内）
        const minutesPastGrace = now.diff(shiftStart, 'minute') - shifts_1.GRACE_MINUTES;
        if (minutesPastGrace >= 0 && minutesPastGrace <= 1) {
            await sendReminderIfNeeded(roster, todayStart, todayEnd, 'CLOCK_IN_URGE', `请尽快打卡`, `${roster.user.name}，你的班次(${roster.startTime}-${roster.endTime})已在${shifts_1.GRACE_MINUTES}分钟前开始，系统将标记为迟到`);
        }
        // 3. 下班前5分钟提醒
        if ((0, roster_1.isShiftEndNear)(roster.endTime, now, 5)) {
            await sendReminderIfNeeded(roster, todayStart, todayEnd, 'CLOCK_OUT_REMINDER', `班次即将结束`, `${roster.user.name}，你的班次(${roster.startTime}-${roster.endTime})将于${roster.endTime}结束，请准备下班打卡`);
        }
    }
}
async function sendReminderIfNeeded(roster, todayStart, todayEnd, pushType, title, body) {
    // Check if already has a clock record
    const existingRecord = pushType === 'CLOCK_OUT_REMINDER'
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
    if (existingRecord)
        return;
    await (0, push_service_1.sendPush)({
        userId: roster.userId,
        title,
        body,
        type: pushType,
        rosterId: roster.id,
    });
}
