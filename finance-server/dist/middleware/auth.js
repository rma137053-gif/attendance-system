"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
async function authMiddleware(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next(new errors_1.UnauthorizedError());
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        // Check tokenVersion
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { tokenVersion: true, status: true },
        });
        if (!user || user.status === 'INACTIVE') {
            return next(new errors_1.UnauthorizedError('账号已被停用'));
        }
        if (user.tokenVersion !== payload.tokenVersion) {
            return next(new errors_1.UnauthorizedError('登录已失效，请重新登录'));
        }
        req.user = payload;
        next();
    }
    catch (err) {
        if (err instanceof errors_1.UnauthorizedError)
            return next(err);
        next(new errors_1.UnauthorizedError('Token 无效或已过期'));
    }
}
//# sourceMappingURL=auth.js.map