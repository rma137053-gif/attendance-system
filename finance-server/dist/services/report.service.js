"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummary = getSummary;
exports.getMonthlyReport = getMonthlyReport;
exports.getCategoryReport = getCategoryReport;
exports.getDailyTrend = getDailyTrend;
exports.exportCSV = exportCSV;
const client_1 = require("@prisma/client");
const dayjs_1 = __importDefault(require("dayjs"));
const timezone_1 = require("../utils/timezone");
const prisma = new client_1.PrismaClient();
async function getSummary(filters) {
    const where = {};
    if (filters.storeId)
        where.storeId = filters.storeId;
    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate)
            where.date.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(filters.startDate, timezone_1.TZ));
        if (filters.endDate)
            where.date.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(filters.endDate, timezone_1.TZ));
    }
    // Aggregations by type
    const [incomeAgg, expenseAgg, statusCounts] = await Promise.all([
        prisma.financeRecord.aggregate({
            where: { ...where, type: 'INCOME' },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.financeRecord.aggregate({
            where: { ...where, type: 'EXPENSE' },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.financeRecord.groupBy({
            by: ['status'],
            where,
            _count: true,
        }),
    ]);
    // Store breakdown
    const storeBreakdown = await prisma.financeRecord.groupBy({
        by: ['storeId'],
        where,
        _sum: { amount: true },
    });
    const stores = await prisma.store.findMany({ select: { id: true, name: true } });
    const breakdown = storeBreakdown.map((s) => {
        const store = stores.find((st) => st.id === s.storeId);
        // Get income and expense for this store
        return { storeId: s.storeId, storeName: store?.name || '未知' };
    });
    // Get per-store income/expense breakdown
    const storeIncomeExpense = await Promise.all(stores.map(async (store) => {
        const [inc, exp] = await Promise.all([
            prisma.financeRecord.aggregate({
                where: { ...where, storeId: store.id, type: 'INCOME' },
                _sum: { amount: true },
            }),
            prisma.financeRecord.aggregate({
                where: { ...where, storeId: store.id, type: 'EXPENSE' },
                _sum: { amount: true },
            }),
        ]);
        return {
            storeId: store.id,
            storeName: store.name,
            income: inc._sum.amount || 0,
            expense: exp._sum.amount || 0,
        };
    }));
    const totalIncome = incomeAgg._sum.amount || 0;
    const totalExpense = expenseAgg._sum.amount || 0;
    const statusMap = {};
    statusCounts.forEach((s) => {
        statusMap[s.status] = s._count;
    });
    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        incomeCount: incomeAgg._count,
        expenseCount: expenseAgg._count,
        pendingCount: statusMap['PENDING'] || 0,
        approvedCount: statusMap['APPROVED'] || 0,
        rejectedCount: statusMap['REJECTED'] || 0,
        storeBreakdown: storeIncomeExpense,
    };
}
async function getMonthlyReport(filters) {
    const year = filters.year || (0, dayjs_1.default)().tz(timezone_1.TZ).year();
    const start = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(`${year}-01-01`, timezone_1.TZ));
    const end = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(`${year + 1}-01-01`, timezone_1.TZ));
    const where = {
        date: { gte: start, lt: end },
    };
    if (filters.storeId)
        where.storeId = filters.storeId;
    const records = await prisma.financeRecord.findMany({
        where,
        select: { date: true, type: true, amount: true },
        orderBy: { date: 'asc' },
    });
    // Group by month
    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        monthlyMap[key] = { month: key, income: 0, expense: 0, net: 0 };
    }
    for (const r of records) {
        const month = (0, timezone_1.toBeijing)(r.date).format('YYYY-MM');
        if (monthlyMap[month]) {
            if (r.type === 'INCOME')
                monthlyMap[month].income += r.amount;
            else
                monthlyMap[month].expense += r.amount;
        }
    }
    for (const m of Object.values(monthlyMap)) {
        m.net = Math.round((m.income - m.expense) * 100) / 100;
        m.income = Math.round(m.income * 100) / 100;
        m.expense = Math.round(m.expense * 100) / 100;
    }
    return Object.values(monthlyMap);
}
async function getCategoryReport(filters) {
    const where = {};
    if (filters.type)
        where.type = filters.type;
    if (filters.storeId)
        where.storeId = filters.storeId;
    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate)
            where.date.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(filters.startDate, timezone_1.TZ));
        if (filters.endDate)
            where.date.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(filters.endDate, timezone_1.TZ));
    }
    const groups = await prisma.financeRecord.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
    });
    const total = groups.reduce((sum, g) => sum + (g._sum.amount || 0), 0);
    const categories = await prisma.financeCategory.findMany({
        select: { id: true, name: true, icon: true },
    });
    return groups.map((g) => {
        const cat = categories.find((c) => c.id === g.categoryId);
        return {
            categoryId: g.categoryId,
            categoryName: cat?.name || '未知',
            categoryIcon: cat?.icon || '',
            total: Math.round((g._sum.amount || 0) * 100) / 100,
            count: g._count,
            percentage: total > 0 ? Math.round(((g._sum.amount || 0) / total) * 10000) / 100 : 0,
        };
    });
}
async function getDailyTrend(filters) {
    const where = {};
    if (filters.type)
        where.type = filters.type;
    if (filters.storeId)
        where.storeId = filters.storeId;
    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate)
            where.date.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(filters.startDate, timezone_1.TZ));
        if (filters.endDate)
            where.date.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(filters.endDate, timezone_1.TZ));
    }
    const records = await prisma.financeRecord.findMany({
        where,
        select: { date: true, type: true, amount: true },
        orderBy: { date: 'asc' },
    });
    // Group by day
    const dayMap = {};
    for (const r of records) {
        const day = (0, timezone_1.toBeijing)(r.date).format('YYYY-MM-DD');
        if (!dayMap[day])
            dayMap[day] = { date: day, income: 0, expense: 0 };
        if (r.type === 'INCOME')
            dayMap[day].income += r.amount;
        else
            dayMap[day].expense += r.amount;
    }
    return Object.values(dayMap).map((d) => ({
        ...d,
        income: Math.round(d.income * 100) / 100,
        expense: Math.round(d.expense * 100) / 100,
    }));
}
async function exportCSV(filters) {
    const where = {};
    if (filters.type)
        where.type = filters.type;
    if (filters.storeId)
        where.storeId = filters.storeId;
    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate)
            where.date.gte = (0, timezone_1.beijingDayStart)(dayjs_1.default.tz(filters.startDate, timezone_1.TZ));
        if (filters.endDate)
            where.date.lte = (0, timezone_1.beijingDayEnd)(dayjs_1.default.tz(filters.endDate, timezone_1.TZ));
    }
    const records = await prisma.financeRecord.findMany({
        where,
        include: {
            category: { select: { name: true } },
            store: { select: { name: true } },
            reviewer: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
    });
    const header = '日期,门店,类型,分类,金额,支付方式,状态,摘要,审核人,审核备注,关联单号';
    const rows = records.map((r) => [
        (0, timezone_1.toBeijing)(r.date).format('YYYY-MM-DD'),
        r.store.name,
        r.type === 'INCOME' ? '收入' : '支出',
        r.category.name,
        r.amount,
        r.paymentMethod || '',
        r.status === 'PENDING' ? '待审核' : r.status === 'APPROVED' ? '已通过' : '已驳回',
        (r.description || '').replace(/,/g, '，'),
        r.reviewer?.name || '',
        (r.reviewNote || '').replace(/,/g, '，'),
        r.referenceId || '',
    ].join(','));
    return '﻿' + [header, ...rows].join('\n');
}
//# sourceMappingURL=report.service.js.map