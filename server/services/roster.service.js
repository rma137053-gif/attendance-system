"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchUpsertRoster = batchUpsertRoster;
exports.queryRoster = queryRoster;
exports.getTodayRoster = getTodayRoster;
exports.deleteRoster = deleteRoster;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const timezone_1 = require("../utils/timezone");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma = new client_1.PrismaClient();
async function batchUpsertRoster(storeId, assignments, requesterStoreId) {
    if (requesterStoreId && requesterStoreId !== storeId) {
        throw new errors_1.ForbiddenError('只能操作本店排班');
    }
    if (assignments.length === 0) {
        throw new errors_1.BadRequestError('排班数据不能为空');
    }
    for (const a of assignments) {
        if (!/^\d{2}:\d{2}$/.test(a.startTime) || !/^\d{2}:\d{2}$/.test(a.endTime)) {
            throw new errors_1.BadRequestError(`无效的时间格式: ${a.startTime}-${a.endTime}`);
        }
    }
    const userIds = [...new Set(assignments.map((a) => a.userId))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
    const userMap = new Map(users.map((u) => [u.id, u]));
    for (const a of assignments) {
        const user = userMap.get(a.userId);
        if (!user)
            throw new errors_1.BadRequestError(`员工不存在: ${a.userId}`);
        if (user.storeId !== storeId)
            throw new errors_1.BadRequestError(`${user.name} 不是本店员工`);
    }
    const existingRosters = await prisma.roster.findMany({
        where: {
            OR: assignments.map((a) => ({
                userId: a.userId,
                shiftDate: (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(a.shiftDate, 'Asia/Shanghai')),
            })),
        },
    });
    const existingMap = new Map(existingRosters.map((r) => [`${r.userId}_${r.shiftDate.toISOString()}`, r]));
    let created = 0;
    let updated = 0;
    const writes = assignments.map((a) => {
        const shiftDateUTC = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(a.shiftDate, 'Asia/Shanghai'));
        const key = `${a.userId}_${shiftDateUTC.toISOString()}`;
        const existing = existingMap.get(key);
        const breakMin = a.breakMinutes ?? existing?.breakMinutes ?? 0;
        if (existing) {
            updated++;
            return prisma.roster.update({
                where: { id: existing.id },
                data: { startTime: a.startTime, endTime: a.endTime, breakMinutes: breakMin },
            });
        }
        else {
            created++;
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
    return { created, updated };
}
async function queryRoster(params, requesterStoreId) {
    const { storeId, startDate, endDate, userId, requesterUserId, requesterRole } = params;
    const where = {};
    // Store scoping
    const effectiveStoreId = requesterStoreId ?? storeId ?? undefined;
    if (effectiveStoreId) {
        where.storeId = effectiveStoreId;
    }
    // EMPLOYEE can only see their own roster
    if (requesterRole === 'EMPLOYEE') {
        where.userId = requesterUserId;
    }
    else if (userId) {
        where.userId = userId;
    }
    if (startDate || endDate) {
        where.shiftDate = {};
        if (startDate) {
            where.shiftDate.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(startDate, 'Asia/Shanghai'));
        }
        if (endDate) {
            where.shiftDate.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(endDate, 'Asia/Shanghai'));
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
    let clockOutMap = new Map(); // key: `${userId}_${dateStr}`, value: clock-out Beijing minutes
    if (rosterUserIds.length > 0) {
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(startDate, 'Asia/Shanghai'));
        if (endDate)
            dateFilter.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(endDate, 'Asia/Shanghai'));
        // Extend to cover all roster dates if no explicit date filter
        if (!startDate && !endDate && rosters.length > 0) {
            const minDate = rosters.reduce((min, r) => r.shiftDate < min ? r.shiftDate : min, rosters[0].shiftDate);
            const maxDate = rosters.reduce((max, r) => r.shiftDate > max ? r.shiftDate : max, rosters[0].shiftDate);
            dateFilter.gte = (0, timezone_1.beijingDayStart)((0, dayjs_1.default)(minDate).tz('Asia/Shanghai'));
            dateFilter.lte = (0, timezone_1.beijingDayEnd)((0, dayjs_1.default)(maxDate).tz('Asia/Shanghai'));
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
            const bjTime = dayjs_1.default.utc(c.createdAt).tz('Asia/Shanghai');
            const dateStr = bjTime.format('YYYY-MM-DD');
            const key = `${c.userId}_${dateStr}`;
            if (!clockOutMap.has(key)) {
                clockOutMap.set(key, bjTime.hour() * 60 + bjTime.minute());
            }
        }
    }
    return rosters.map((r) => {
        const dateStr = (0, dayjs_1.default)(r.shiftDate).format('YYYY-MM-DD');
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
        return {
            ...r,
            shiftDate: (0, timezone_1.formatBeijing)(r.shiftDate),
            overtimeMinutes,
        };
    });
}
async function getTodayRoster(userId, requesterStoreId, role) {
    const today = (0, timezone_1.nowBeijing)();
    const dayStart = (0, timezone_1.beijingDayStart)(today);
    const dayEnd = (0, timezone_1.beijingDayEnd)(today);
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
        const where = {
            shiftDate: { gte: dayStart, lte: dayEnd },
            user: { role: 'EMPLOYEE' },
        };
        if (requesterStoreId)
            where.storeId = requesterStoreId;
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
        throw new errors_1.ForbiddenError('只能查看本店排班');
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
    return {
        myShift: {
            id: myRoster.id,
            startTime: myRoster.startTime,
            endTime: myRoster.endTime,
            shiftDate: (0, timezone_1.formatBeijing)(myRoster.shiftDate),
            user: myRoster.user,
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
            createdAt: (0, timezone_1.formatBeijing)(n.createdAt),
        })),
    };
}
async function deleteRoster(rosterId, requesterStoreId) {
    const roster = await prisma.roster.findUnique({ where: { id: rosterId } });
    if (!roster)
        throw new errors_1.NotFoundError('排班记录不存在');
    if (requesterStoreId && roster.storeId !== requesterStoreId) {
        throw new errors_1.ForbiddenError('只能操作本店排班');
    }
    await prisma.roster.delete({ where: { id: rosterId } });
}
function parseTimeMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
