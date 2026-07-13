"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHandoverNote = createHandoverNote;
exports.listHandoverNotes = listHandoverNotes;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const timezone_1 = require("../utils/timezone");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma = new client_1.PrismaClient();
async function createHandoverNote(rosterId, authorId, content, requesterStoreId) {
    if (!content.trim()) {
        throw new errors_1.BadRequestError('备注内容不能为空');
    }
    const roster = await prisma.roster.findUnique({
        where: { id: rosterId },
        include: {
            user: { select: { id: true, name: true, storeId: true } },
        },
    });
    if (!roster)
        throw new errors_1.NotFoundError('排班记录不存在');
    if (requesterStoreId && roster.storeId !== requesterStoreId) {
        throw new errors_1.ForbiddenError('只能查看本店排班');
    }
    // Check: can't write notes for future shifts
    const rosterBeijing = (0, dayjs_1.default)(roster.shiftDate).tz('Asia/Shanghai');
    const todayBeijing = (0, timezone_1.nowBeijing)().startOf('day');
    if (rosterBeijing.isAfter(todayBeijing)) {
        throw new errors_1.BadRequestError('不能给未来日期的班次写备注');
    }
    // Check: author must be a colleague (same store, same day, any shift)
    // or the roster owner themselves
    const dayStart = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(roster.shiftDate, 'UTC'));
    const dayEnd = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(roster.shiftDate, 'UTC'));
    const isColleague = await prisma.roster.findFirst({
        where: {
            storeId: roster.storeId,
            shiftDate: { gte: dayStart, lte: dayEnd },
            userId: authorId,
        },
    });
    if (!isColleague) {
        throw new errors_1.ForbiddenError('只有同天同店搭班的同事才能写交接备注');
    }
    const note = await prisma.handoverNote.create({
        data: { rosterId, authorId, content: content.trim() },
        include: {
            author: { select: { id: true, name: true } },
        },
    });
    return {
        ...note,
        createdAt: (0, timezone_1.formatBeijing)(note.createdAt),
    };
}
async function listHandoverNotes(rosterId, requesterStoreId) {
    const roster = await prisma.roster.findUnique({ where: { id: rosterId } });
    if (!roster)
        throw new errors_1.NotFoundError('排班记录不存在');
    if (requesterStoreId && roster.storeId !== requesterStoreId) {
        throw new errors_1.ForbiddenError('只能查看本店排班');
    }
    const notes = await prisma.handoverNote.findMany({
        where: { rosterId },
        include: {
            author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return notes.map((n) => ({
        ...n,
        createdAt: (0, timezone_1.formatBeijing)(n.createdAt),
    }));
}
