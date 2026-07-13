"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeeklyReport = getWeeklyReport;
exports.getMonthlyReport = getMonthlyReport;
exports.getYearlyReport = getYearlyReport;
exports.generateSummary = generateSummary;
exports.generateCsv = generateCsv;
const client_1 = require("@prisma/client");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const isoWeek_1 = __importDefault(require("dayjs/plugin/isoWeek"));
const timezone_2 = require("../utils/timezone");
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
dayjs_1.default.extend(isoWeek_1.default);
const prisma = new client_1.PrismaClient();
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
function buildUserDayMap(records) {
    const userDayMap = new Map();
    for (const r of records) {
        if (!userDayMap.has(r.userId)) {
            userDayMap.set(r.userId, new Map());
        }
        const dayMap = userDayMap.get(r.userId);
        const dayKey = dayjs_1.default.utc(r.createdAt).tz(timezone_2.TZ).format('YYYY-MM-DD');
        if (!dayMap.has(dayKey)) {
            dayMap.set(dayKey, { ins: [], outs: [] });
        }
        const entry = dayMap.get(dayKey);
        if (r.type === 'CLOCK_IN') {
            entry.ins.push((0, timezone_2.toBeijing)(r.createdAt));
        }
        else {
            entry.outs.push((0, timezone_2.toBeijing)(r.createdAt));
        }
    }
    return userDayMap;
}
function computeDailyHours(entry) {
    if (entry.ins.length === 0 || entry.outs.length === 0)
        return 0;
    const firstIn = entry.ins.sort((a, b) => a.valueOf() - b.valueOf())[0];
    const lastOut = entry.outs.sort((a, b) => b.valueOf() - a.valueOf())[0];
    const diffMinutes = lastOut.diff(firstIn, 'minute');
    if (diffMinutes <= 0)
        return 0;
    return Math.round((diffMinutes / 60) * 10) / 10; // round to 1 decimal
}
function computeRow(userId, userName, userEmail, storeName, dayMap) {
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
            if (diff > 0)
                totalMinutes += diff;
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
    };
}
async function getWeeklyReport(storeId, dateStr) {
    const refDate = dateStr ? dayjs_1.default.tz(dateStr, timezone_2.TZ) : (0, dayjs_1.default)().tz(timezone_2.TZ);
    const weekStart = (0, timezone_2.beijingWeekStart)(refDate);
    const weekEnd = (0, timezone_2.beijingWeekEnd)(refDate);
    const userWhere = { status: 'ACTIVE' };
    if (storeId)
        userWhere.storeId = storeId;
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
    return users.map((u) => {
        const dayMap = userDayMap.get(u.id) || new Map();
        return {
            ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayMap),
            weekStart: (0, timezone_2.formatBeijing)(weekStart),
            weekEnd: (0, timezone_2.formatBeijing)(weekEnd),
        };
    });
}
async function getMonthlyReport(storeId, monthStr) {
    const refDate = monthStr ? dayjs_1.default.tz(monthStr, timezone_2.TZ) : (0, dayjs_1.default)().tz(timezone_2.TZ);
    const monthStart = (0, timezone_2.beijingMonthStart)(refDate);
    const monthEnd = (0, timezone_2.beijingMonthEnd)(refDate);
    const userWhere = { status: 'ACTIVE' };
    if (storeId)
        userWhere.storeId = storeId;
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
    return users.map((u) => {
        const dayMap = userDayMap.get(u.id) || new Map();
        return {
            ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayMap),
            month: refDate.format('YYYY-MM'),
        };
    });
}
async function getYearlyReport(storeId, yearStr) {
    const year = yearStr ? parseInt(yearStr) : (0, dayjs_1.default)().tz(timezone_2.TZ).year();
    const yearStart = dayjs_1.default.tz(`${year}-01-01`, timezone_2.TZ).startOf('year').utc().toDate();
    const yearEnd = dayjs_1.default.tz(`${year}-12-31`, timezone_2.TZ).endOf('year').utc().toDate();
    const userWhere = { status: 'ACTIVE' };
    if (storeId)
        userWhere.storeId = storeId;
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
    return users.map((u) => {
        const dayMap = userDayMap.get(u.id) || new Map();
        return {
            ...computeRow(u.id, u.name, u.email, u.store?.name ?? '', dayMap),
            year: `${year}`,
        };
    });
}
function generateSummary(rows) {
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
        if (r.missingClockOut)
            anyMissing = true;
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
    };
}
function generateCsv(rows) {
    if (rows.length === 0)
        return '';
    const summary = generateSummary(rows);
    const allRows = [...rows, summary];
    const headers = ['姓名', '邮箱', '门店', '上班次数', '下班次数', '出勤天数', '总工时(h)', '迟到次数', '早退次数', '缺下班卡'];
    const lines = [headers.join(',')];
    for (const row of allRows) {
        const values = [
            row.userName || '',
            row.userEmail || '',
            row.storeName || '',
            String(row.clockInCount),
            String(row.clockOutCount),
            String(row.daysWithRecords),
            String(row.totalHours ?? '0'),
            String(row.lateCount ?? ''),
            String(row.earlyCount ?? ''),
            row.missingClockOut ? '是' : '否',
        ];
        lines.push(values.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
    }
    return lines.join('\n');
}
