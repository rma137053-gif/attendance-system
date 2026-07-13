"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStores = listStores;
exports.listEmployeeRoster = listEmployeeRoster;
exports.listEmployees = listEmployees;
exports.createEmployee = createEmployee;
exports.verifyPin = verifyPin;
exports.updateEmployee = updateEmployee;
exports.toggleEmployeeStatus = toggleEmployeeStatus;
exports.resetPassword = resetPassword;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errors_1 = require("../utils/errors");
const timezone_1 = require("../utils/timezone");
const prisma = new client_1.PrismaClient();
async function listStores() {
    return prisma.store.findMany({ orderBy: { name: 'asc' } });
}
async function listEmployeeRoster(storeId) {
    const where = { status: 'ACTIVE', role: 'EMPLOYEE' };
    if (storeId)
        where.storeId = storeId;
    const employees = await prisma.user.findMany({
        where,
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
    });
    if (employees.length === 0)
        return [];
    // Fetch today's roster for all employees
    const today = (0, timezone_1.nowBeijing)();
    const dayStart = (0, timezone_1.beijingDayStart)(today);
    const dayEnd = (0, timezone_1.beijingDayEnd)(today);
    const rosters = await prisma.roster.findMany({
        where: {
            userId: { in: employees.map((e) => e.id) },
            shiftDate: { gte: dayStart, lte: dayEnd },
        },
        select: { userId: true, startTime: true, endTime: true },
    });
    const rosterMap = new Map(rosters.map((r) => [r.userId, { startTime: r.startTime, endTime: r.endTime }]));
    return employees.map((e) => ({
        ...e,
        startTime: rosterMap.get(e.id)?.startTime ?? null,
        endTime: rosterMap.get(e.id)?.endTime ?? null,
    }));
}
async function listEmployees(storeId) {
    const where = { status: 'ACTIVE' };
    if (storeId)
        where.storeId = storeId;
    return prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, role: true, status: true, pin: true, createdAt: true, storeId: true, store: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
    });
}
async function createEmployee(email, password, name, storeId, pin) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new errors_1.BadRequestError('该邮箱已被注册');
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
        throw new errors_1.BadRequestError('PIN码必须为4-6位数字');
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    return prisma.user.create({
        data: { email, passwordHash, name, role: 'EMPLOYEE', storeId, pin },
        select: { id: true, email: true, name: true, role: true, status: true, storeId: true, store: { select: { id: true, name: true } } },
    });
}
async function verifyPin(userId, pin, storeId) {
    const where = { id: userId, role: 'EMPLOYEE', status: 'ACTIVE' };
    if (storeId)
        where.storeId = storeId;
    const user = await prisma.user.findFirst({ where, select: { id: true, pin: true, name: true } });
    if (!user)
        throw new errors_1.NotFoundError('员工不存在');
    if (!user.pin)
        throw new errors_1.BadRequestError('该员工未设置PIN码');
    if (user.pin !== pin)
        throw new errors_1.BadRequestError('PIN码不正确');
    return { id: user.id, name: user.name };
}
async function updateEmployee(id, data, storeId) {
    const where = { id };
    if (storeId)
        where.storeId = storeId;
    const user = await prisma.user.findFirst({ where });
    if (!user)
        throw new errors_1.NotFoundError('员工不存在');
    if (data.email && data.email !== user.email) {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing)
            throw new errors_1.BadRequestError('该邮箱已被注册');
    }
    if (data.pin !== undefined && data.pin !== '' && !/^\d{4,6}$/.test(data.pin)) {
        throw new errors_1.BadRequestError('PIN码必须为4-6位数字');
    }
    // Allow clearing PIN by passing empty string
    const updateData = { ...data };
    if (data.pin === '')
        updateData.pin = null;
    return prisma.user.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, name: true, role: true, status: true, pin: true, storeId: true, store: { select: { id: true, name: true } } },
    });
}
async function toggleEmployeeStatus(id, storeId) {
    const where = { id, role: 'EMPLOYEE' };
    if (storeId)
        where.storeId = storeId;
    const user = await prisma.user.findFirst({ where });
    if (!user)
        throw new errors_1.NotFoundError('员工不存在');
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return prisma.user.update({
        where: { id },
        data: { status: newStatus },
        select: { id: true, email: true, name: true, role: true, status: true, storeId: true, store: { select: { id: true, name: true } } },
    });
}
async function resetPassword(id, newPassword, storeId) {
    const where = { id, role: 'EMPLOYEE' };
    if (storeId)
        where.storeId = storeId;
    const user = await prisma.user.findFirst({ where });
    if (!user)
        throw new errors_1.NotFoundError('员工不存在');
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
}
