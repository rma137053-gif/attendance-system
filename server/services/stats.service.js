"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayStats = getTodayStats;
const client_1 = require("@prisma/client");
const timezone_1 = require("../utils/timezone");
const prisma = new client_1.PrismaClient();
async function getTodayStats(storeId) {
    const today = (0, timezone_1.nowBeijing)();
    const dayStart = (0, timezone_1.beijingDayStart)(today);
    const dayEnd = (0, timezone_1.beijingDayEnd)(today);
    const userWhere = { status: 'ACTIVE' };
    if (storeId)
        userWhere.storeId = storeId;
    const [allUsers, todayRecords] = await Promise.all([
        prisma.user.findMany({
            where: userWhere,
            select: { id: true, name: true, email: true, store: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' },
        }),
        prisma.clockRecord.findMany({
            where: {
                createdAt: { gte: dayStart, lte: dayEnd },
            },
            select: { userId: true, type: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        }),
    ]);
    const userRecordMap = new Map();
    for (const r of todayRecords) {
        if (!userRecordMap.has(r.userId)) {
            userRecordMap.set(r.userId, { clockIns: [], clockOuts: [] });
        }
        const entry = userRecordMap.get(r.userId);
        if (r.type === 'CLOCK_IN')
            entry.clockIns.push(r.createdAt);
        else
            entry.clockOuts.push(r.createdAt);
    }
    const clockedIn = [];
    const notClockedIn = [];
    const missingClockOut = [];
    for (const u of allUsers) {
        const storeName = u.store?.name ?? '';
        const entry = userRecordMap.get(u.id);
        if (!entry || entry.clockIns.length === 0) {
            notClockedIn.push({ id: u.id, name: u.name, email: u.email, storeName });
        }
        else {
            const firstIn = entry.clockIns[0];
            const lastOut = entry.clockOuts.length > 0 ? entry.clockOuts[entry.clockOuts.length - 1] : null;
            clockedIn.push({
                id: u.id,
                name: u.name,
                email: u.email,
                storeName,
                firstIn: (0, timezone_1.toBeijing)(firstIn).format('HH:mm:ss'),
                lastOut: lastOut ? (0, timezone_1.toBeijing)(lastOut).format('HH:mm:ss') : null,
            });
            if (!lastOut) {
                missingClockOut.push({ id: u.id, name: u.name, email: u.email, storeName });
            }
        }
    }
    return {
        date: today.format('YYYY-MM-DD'),
        totalEmployees: allUsers.length,
        clockedInCount: clockedIn.length,
        notClockedInCount: notClockedIn.length,
        clockedOutCount: clockedIn.filter((c) => c.lastOut).length,
        missingClockOutCount: missingClockOut.length,
        clockedIn,
        notClockedIn,
        missingClockOut,
    };
}
