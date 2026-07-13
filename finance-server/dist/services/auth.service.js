"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getMe = getMe;
exports.changePassword = changePassword;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
async function login({ username, password }) {
    const user = await prisma.user.findUnique({
        where: { username },
        include: { store: { select: { id: true, name: true } } },
    });
    if (!user || user.status === 'INACTIVE') {
        throw new errors_1.UnauthorizedError('用户名或密码错误');
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        throw new errors_1.UnauthorizedError('用户名或密码错误');
    }
    const payload = {
        userId: user.id,
        role: user.role,
        storeId: user.storeId,
        tokenVersion: user.tokenVersion,
    };
    const token = jsonwebtoken_1.default.sign(payload, config_1.config.jwtSecret, {
        expiresIn: '36500d',
    });
    return {
        token,
        expiresIn: config_1.config.jwtExpiresIn,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            storeId: user.storeId,
            store: user.store,
        },
    };
}
async function getMe(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            status: true,
            storeId: true,
            store: { select: { id: true, name: true } },
        },
    });
    if (!user || user.status === 'INACTIVE') {
        throw new errors_1.NotFoundError('用户不存在');
    }
    return user;
}
async function changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errors_1.NotFoundError('用户不存在');
    const valid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
    if (!valid)
        throw new errors_1.BadRequestError('当前密码错误');
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: {
            passwordHash,
            tokenVersion: { increment: 1 }, // invalidate existing tokens
        },
    });
    return { message: '密码修改成功' };
}
//# sourceMappingURL=auth.service.js.map