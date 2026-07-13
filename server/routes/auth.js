"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const authService = __importStar(require("../services/auth.service"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('邮箱格式不正确'),
    password: zod_1.z.string().min(6, '密码至少6位'),
    name: zod_1.z.string().min(1, '姓名不能为空'),
    storeId: zod_1.z.string().uuid('门店ID无效'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('邮箱格式不正确'),
    password: zod_1.z.string().min(1, '密码不能为空'),
});
router.post('/register', async (req, res, next) => {
    try {
        const body = registerSchema.parse(req.body);
        const user = await authService.register(body.email, body.password, body.name, body.storeId);
        res.status(201).json(user);
    }
    catch (err) {
        next(err);
    }
});
router.post('/login', async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const result = await authService.login(body.email, body.password);
        res.cookie('token', result.token, {
            path: '/',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/me', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const user = await authService.getMe(req.user.userId);
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, '当前密码不能为空'),
    newPassword: zod_1.z.string().min(6, '新密码至少6位'),
});
router.put('/password', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const body = changePasswordSchema.parse(req.body);
        await authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
        res.json({ message: '密码修改成功' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
