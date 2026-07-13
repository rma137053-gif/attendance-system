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
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const authService = __importStar(require("../services/auth.service"));
const router = (0, express_1.Router)();
// ── POST /auth/login ──
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, '用户名不能为空'),
    password: zod_1.z.string().min(1, '密码不能为空'),
});
router.post('/login', async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const result = await authService.login(body);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /auth/me ──
router.get('/me', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const user = await authService.getMe(req.user.userId);
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
// ── PUT /auth/password ──
const passwordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, '当前密码不能为空'),
    newPassword: zod_1.z.string().min(4, '新密码至少4位'),
});
router.put('/password', auth_1.authMiddleware, (0, audit_1.audit)('CHANGE_PASSWORD', 'User'), async (req, res, next) => {
    try {
        const body = passwordSchema.parse(req.body);
        const result = await authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map