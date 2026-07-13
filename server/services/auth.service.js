"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.changePassword = changePassword;
exports.getMe = getMe;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
async function register(email, password, name, storeId) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new errors_1.BadRequestError('该邮箱已被注册');
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma.user.create({
        data: { email, passwordHash, name, role: 'EMPLOYEE', storeId },
        select: { id: true, email: true, name: true, role: true, storeId: true },
    });
    return user;
}
async function login(email, password) {
    const user = await prisma.user.findUnique({
        where: { email },
        include: { store: { select: { id: true, name: true } } },
    });
    if (!user) {
        throw new errors_1.UnauthorizedError('邮箱或密码错误');
    }
    if (user.status === 'INACTIVE') {
        throw new errors_1.UnauthorizedError('账号已被停用');
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        throw new errors_1.UnauthorizedError('邮箱或密码错误');
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role, storeId: user.storeId }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            storeId: user.storeId,
            storeName: user.store?.name ?? null,
        },
    };
}
async function changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errors_1.UnauthorizedError();
    const valid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
    if (!valid)
        throw new errors_1.BadRequestError('当前密码不正确');
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
async function getMe(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, status: true, storeId: true, store: { select: { id: true, name: true } } },
    });
    if (!user)
        throw new errors_1.UnauthorizedError();
    return user;
}
