"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRecord = createRecord;
exports.queryRecords = queryRecords;
exports.getPhotoForRecord = getPhotoForRecord;
exports.toggleAnomaly = toggleAnomaly;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const timezone_1 = require("../utils/timezone");
const roster_1 = require("../utils/roster");
const storage_service_1 = require("./storage.service");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma = new client_1.PrismaClient();
const CLOCK_IN_WINDOW_START = 5; // 05:00 Beijing
const CLOCK_IN_WINDOW_END = 23; // 23:00 Beijing (exclusive)
const CLOCK_OUT_WINDOW_START = 12; // 12:00 Beijing
const CLOCK_OUT_WINDOW_END = 23; // 23:59 Beijing
function isWithinWindow(type, hour) {
    if (type === 'CLOCK_IN')
        return hour >= CLOCK_IN_WINDOW_START && hour < CLOCK_IN_WINDOW_END;
    return hour >= CLOCK_OUT_WINDOW_START && hour <= CLOCK_OUT_WINDOW_END;
}
async function createRecord(params) {
    const { userId, type, photoBuffer, photoOriginalName, requesterStoreId } = params;
    if (!photoBuffer) {
        throw new errors_1.BadRequestError('打卡必须拍照');
    }
    // If a store-scoped user is clocking on behalf of someone, verify same store
    if (requesterStoreId) {
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.storeId !== requesterStoreId) {
            throw new errors_1.BadRequestError('只能为本店员工打卡');
        }
    }
    // Look up today's roster for roster linkage
    const todayStart = (0, timezone_1.beijingDayStart)((0, timezone_1.nowBeijing)());
    const todayEnd = (0, timezone_1.beijingDayEnd)((0, timezone_1.nowBeijing)());
    const roster = await prisma.roster.findFirst({
        where: {
            userId,
            shiftDate: { gte: todayStart, lte: todayEnd },
        },
    });
    let rosterId = null;
    let lateMinutes = null;
    let note = null;
    // Check if within valid time window
    const beijingHour = (0, timezone_1.nowBeijing)().hour();
    // With roster: use roster-based anomaly detection instead of time window
    let isAnomalous;
    if (roster && type === 'CLOCK_IN') {
        const now = (0, timezone_1.nowBeijing)();
        lateMinutes = (0, roster_1.calcLateMinutes)(roster.startTime, now);
        isAnomalous = lateMinutes > 0;
        note = isAnomalous
            ? `${roster.startTime}-${roster.endTime}, 迟到 ${lateMinutes} 分钟`
            : `${roster.startTime}-${roster.endTime}, 准时`;
    }
    else if (roster && type === 'CLOCK_OUT') {
        const now = (0, timezone_1.nowBeijing)();
        const end = (0, roster_1.parseTimeToBeijing)(now, roster.endTime);
        if (now.isBefore(end)) {
            const earlyMinutes = end.diff(now, 'minute');
            isAnomalous = true;
            note = `提前 ${earlyMinutes} 分钟下班`;
        }
        else {
            isAnomalous = false;
            note = `${roster.startTime}-${roster.endTime}, 准时下班`;
        }
    }
    else {
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
            createdAt: (0, timezone_1.formatBeijing)(existingSameType.createdAt),
            user: clockUser ?? { id: userId, name: '', email: '' },
            rosterId: existingSameType.rosterId,
            lateMinutes: existingSameType.lateMinutes,
            note: existingSameType.note,
            duplicate: true,
        };
    }
    if (existingSameType && type === 'CLOCK_OUT') {
        // Keep last clock-out — save new photo first, then replace old record atomically
        const photoKey = await (0, storage_service_1.savePhoto)(photoBuffer, photoOriginalName || 'photo.jpg');
        if (existingSameType.photoKey) {
            await (0, storage_service_1.deletePhoto)(existingSameType.photoKey).catch(() => { });
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
            createdAt: (0, timezone_1.formatBeijing)(record.createdAt),
        };
    }
    const photoKey = await (0, storage_service_1.savePhoto)(photoBuffer, photoOriginalName || 'photo.jpg');
    const record = await prisma.clockRecord.create({
        data: { userId, type, photoKey, isAnomalous, rosterId, lateMinutes, note },
        include: {
            user: { select: { id: true, name: true, email: true } },
        },
    });
    return {
        ...record,
        createdAt: (0, timezone_1.formatBeijing)(record.createdAt),
    };
}
async function queryRecords(params, storeId, _requesterRole) {
    const { userId, startDate, endDate, type, anomalous, page = 1, pageSize = 20 } = params;
    const where = {};
    if (storeId) {
        where.user = { storeId };
    }
    if (userId) {
        where.userId = userId;
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            where.createdAt.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(startDate, 'Asia/Shanghai'));
        }
        if (endDate) {
            where.createdAt.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(endDate, 'Asia/Shanghai'));
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
            createdAt: (0, timezone_1.formatBeijing)(r.createdAt),
            hasPhoto: !!r.photoKey,
            isAnomalous: r.isAnomalous,
        })),
        total,
        page,
        pageSize,
    };
}
async function getPhotoForRecord(recordId, requesterUserId, requesterRole, requesterStoreId) {
    const record = await prisma.clockRecord.findUnique({
        where: { id: recordId },
        include: { user: { select: { id: true, storeId: true } } },
    });
    if (!record)
        throw new errors_1.NotFoundError('打卡记录不存在');
    // Employees can only view their own photos; STORE_ADMIN can view their store's employees
    const isStoreAdminOfRecord = requesterRole === 'STORE_ADMIN' && requesterStoreId === record.user.storeId;
    if (requesterRole !== 'ADMIN' && record.userId !== requesterUserId && !isStoreAdminOfRecord) {
        throw new errors_1.NotFoundError('打卡记录不存在');
    }
    // Store-scoped admin can only see their store's photos
    if (requesterStoreId && record.user.storeId !== requesterStoreId) {
        throw new errors_1.NotFoundError('打卡记录不存在');
    }
    if (!record.photoKey)
        throw new errors_1.NotFoundError('该记录无照片');
    const buffer = await (0, storage_service_1.getPhoto)(record.photoKey);
    return buffer;
}
async function toggleAnomaly(recordId, requesterStoreId) {
    const record = await prisma.clockRecord.findUnique({
        where: { id: recordId },
        include: { user: { select: { id: true, name: true, email: true, storeId: true, store: { select: { id: true, name: true } } } } },
    });
    if (!record)
        throw new errors_1.NotFoundError('打卡记录不存在');
    // Global admin can toggle any; store-scoped admin can only toggle their store
    if (requesterStoreId && record.user.storeId !== requesterStoreId) {
        throw new errors_1.NotFoundError('打卡记录不存在');
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
        createdAt: (0, timezone_1.formatBeijing)(updated.createdAt),
        hasPhoto: !!updated.photoKey,
    };
}
