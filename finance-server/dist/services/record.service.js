"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRecords = listRecords;
exports.getRecord = getRecord;
exports.createRecord = createRecord;
exports.updateRecord = updateRecord;
exports.deleteRecord = deleteRecord;
exports.reviewRecord = reviewRecord;
exports.batchReview = batchReview;
const client_1 = require("@prisma/client");
const dayjs_1 = __importDefault(require("dayjs"));
const errors_1 = require("../utils/errors");
const timezone_1 = require("../utils/timezone");
const prisma = new client_1.PrismaClient();
async function listRecords(params) {
    const where = {};
    if (params.type)
        where.type = params.type;
    if (params.storeId)
        where.storeId = params.storeId;
    if (params.categoryId)
        where.categoryId = params.categoryId;
    if (params.status)
        where.status = params.status;
    // Date range filter
    if (params.startDate || params.endDate) {
        where.date = {};
        if (params.startDate) {
            where.date.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(params.startDate, timezone_1.TZ));
        }
        if (params.endDate) {
            where.date.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(params.endDate, timezone_1.TZ));
        }
    }
    // Keyword search on description
    if (params.keyword) {
        where.description = { contains: params.keyword };
    }
    const [items, total] = await Promise.all([
        prisma.financeRecord.findMany({
            where,
            include: {
                category: { select: { id: true, name: true, type: true, icon: true } },
                store: { select: { id: true, name: true } },
                reviewer: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
            skip: (params.page - 1) * params.pageSize,
            take: params.pageSize,
        }),
        prisma.financeRecord.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize };
}
async function getRecord(id) {
    const record = await prisma.financeRecord.findUnique({
        where: { id },
        include: {
            category: { select: { id: true, name: true, type: true, icon: true } },
            store: { select: { id: true, name: true } },
            reviewer: { select: { id: true, name: true } },
        },
    });
    if (!record)
        throw new errors_1.NotFoundError('记录不存在');
    return record;
}
async function createRecord(params) {
    if (!['INCOME', 'EXPENSE'].includes(params.type)) {
        throw new errors_1.BadRequestError('类型必须为 INCOME 或 EXPENSE');
    }
    if (params.amount <= 0) {
        throw new errors_1.BadRequestError('金额必须大于0');
    }
    // Verify category exists and matches type
    const category = await prisma.financeCategory.findUnique({ where: { id: params.categoryId } });
    if (!category)
        throw new errors_1.NotFoundError('分类不存在');
    if (category.type !== params.type)
        throw new errors_1.BadRequestError('分类类型与记录类型不匹配');
    // Verify store exists
    const store = await prisma.store.findUnique({ where: { id: params.storeId } });
    if (!store)
        throw new errors_1.NotFoundError('门店不存在');
    const date = dayjs_1.default.tz(params.date, timezone_1.TZ).startOf('day').utc().toDate();
    return prisma.financeRecord.create({
        data: {
            type: params.type,
            amount: params.amount,
            categoryId: params.categoryId,
            storeId: params.storeId,
            date,
            description: params.description || null,
            paymentMethod: params.paymentMethod || null,
            referenceType: params.referenceType || null,
            referenceId: params.referenceId || null,
            status: 'PENDING',
        },
        include: {
            category: { select: { id: true, name: true, type: true, icon: true } },
            store: { select: { id: true, name: true } },
        },
    });
}
async function updateRecord(id, params) {
    const record = await prisma.financeRecord.findUnique({ where: { id } });
    if (!record)
        throw new errors_1.NotFoundError('记录不存在');
    // Only PENDING records can be edited
    if (record.status !== 'PENDING') {
        throw new errors_1.BadRequestError('已审核的记录不可修改');
    }
    const data = {};
    if (params.amount !== undefined) {
        if (params.amount <= 0)
            throw new errors_1.BadRequestError('金额必须大于0');
        data.amount = params.amount;
    }
    if (params.categoryId !== undefined) {
        const category = await prisma.financeCategory.findUnique({ where: { id: params.categoryId } });
        if (!category)
            throw new errors_1.NotFoundError('分类不存在');
        if (category.type !== record.type)
            throw new errors_1.BadRequestError('分类类型与记录类型不匹配');
        data.categoryId = params.categoryId;
    }
    if (params.date) {
        data.date = dayjs_1.default.tz(params.date, timezone_1.TZ).startOf('day').utc().toDate();
    }
    if (params.description !== undefined)
        data.description = params.description || null;
    if (params.paymentMethod !== undefined)
        data.paymentMethod = params.paymentMethod || null;
    if (params.referenceType !== undefined)
        data.referenceType = params.referenceType || null;
    if (params.referenceId !== undefined)
        data.referenceId = params.referenceId || null;
    return prisma.financeRecord.update({
        where: { id },
        data,
        include: {
            category: { select: { id: true, name: true, type: true, icon: true } },
            store: { select: { id: true, name: true } },
            reviewer: { select: { id: true, name: true } },
        },
    });
}
async function deleteRecord(id) {
    const record = await prisma.financeRecord.findUnique({ where: { id } });
    if (!record)
        throw new errors_1.NotFoundError('记录不存在');
    if (record.status !== 'PENDING') {
        throw new errors_1.BadRequestError('已审核的记录不可删除');
    }
    return prisma.financeRecord.delete({ where: { id } });
}
async function reviewRecord(id, status, reviewerId, reviewNote) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new errors_1.BadRequestError('审核状态必须为 APPROVED 或 REJECTED');
    }
    const record = await prisma.financeRecord.findUnique({ where: { id } });
    if (!record)
        throw new errors_1.NotFoundError('记录不存在');
    return prisma.financeRecord.update({
        where: { id },
        data: {
            status,
            reviewerId,
            reviewNote: reviewNote || null,
            reviewedAt: new Date(),
        },
        include: {
            category: { select: { id: true, name: true, type: true, icon: true } },
            store: { select: { id: true, name: true } },
            reviewer: { select: { id: true, name: true } },
        },
    });
}
async function batchReview(ids, status, reviewerId, reviewNote) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new errors_1.BadRequestError('审核状态必须为 APPROVED 或 REJECTED');
    }
    const result = await prisma.financeRecord.updateMany({
        where: { id: { in: ids }, status: 'PENDING' },
        data: {
            status,
            reviewerId,
            reviewNote: reviewNote || null,
            reviewedAt: new Date(),
        },
    });
    return { updatedCount: result.count };
}
//# sourceMappingURL=record.service.js.map