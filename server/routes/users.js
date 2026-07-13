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
const requireAdmin_1 = require("../middleware/requireAdmin");
const requireStoreAdmin_1 = require("../middleware/requireStoreAdmin");
const userService = __importStar(require("../services/user.service"));
const router = (0, express_1.Router)();
// Employee roster — STORE_ADMIN+ can access (scoped to their store)
router.get('/roster', auth_1.authMiddleware, requireStoreAdmin_1.requireStoreAdmin, async (req, res, next) => {
    try {
        const users = await userService.listEmployeeRoster(req.user.storeId);
        res.json(users);
    }
    catch (err) {
        next(err);
    }
});
// PIN verification — any authenticated user can verify an employee's PIN
const verifyPinSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, '员工ID不能为空'),
    pin: zod_1.z.string().regex(/^\d{4,6}$/, 'PIN码必须为4-6位数字'),
});
router.post('/verify-pin', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const body = verifyPinSchema.parse(req.body);
        const result = await userService.verifyPin(body.userId, body.pin, req.user.storeId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// All routes below require at least STORE_ADMIN
router.use(auth_1.authMiddleware, requireStoreAdmin_1.requireStoreAdmin);
// List stores — ADMIN only
router.get('/stores', requireAdmin_1.requireAdmin, async (_req, res, next) => {
    try {
        const stores = await userService.listStores();
        res.json(stores);
    }
    catch (err) {
        next(err);
    }
});
const createSchema = zod_1.z.object({
    email: zod_1.z.string().email('邮箱格式不正确'),
    password: zod_1.z.string().min(6, '密码至少6位'),
    name: zod_1.z.string().min(1, '姓名不能为空'),
    storeId: zod_1.z.string().optional(),
    pin: zod_1.z.string().regex(/^\d{4,6}$/, 'PIN码必须为4-6位数字').optional(),
});
router.get('/', async (req, res, next) => {
    try {
        const effectiveStoreId = req.user.role === 'ADMIN' && req.query.storeId
            ? req.query.storeId
            : req.user.storeId;
        const users = await userService.listEmployees(effectiveStoreId);
        res.json(users);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const body = createSchema.parse(req.body);
        // STORE_ADMIN always creates in their own store; ADMIN can specify
        const storeId = req.user.role === 'ADMIN' && body.storeId
            ? body.storeId
            : req.user.storeId;
        const user = await userService.createEmployee(body.email, body.password, body.name, storeId, body.pin);
        res.status(201).json(user);
    }
    catch (err) {
        next(err);
    }
});
// ADMIN-only routes
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '姓名不能为空').optional(),
    email: zod_1.z.string().email('邮箱格式不正确').optional(),
    pin: zod_1.z.string().regex(/^\d{4,6}$/, 'PIN码必须为4-6位数字').optional().or(zod_1.z.literal('')),
});
router.put('/:id', requireAdmin_1.requireAdmin, async (req, res, next) => {
    try {
        const body = updateSchema.parse(req.body);
        const user = await userService.updateEmployee(req.params.id, body, req.user.storeId);
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id/status', requireAdmin_1.requireAdmin, async (req, res, next) => {
    try {
        const user = await userService.toggleEmployeeStatus(req.params.id, req.user.storeId);
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
const resetPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(6, '密码至少6位'),
});
router.put('/:id/password', requireAdmin_1.requireAdmin, async (req, res, next) => {
    try {
        const body = resetPasswordSchema.parse(req.body);
        await userService.resetPassword(req.params.id, body.password, req.user.storeId);
        res.json({ message: '密码重置成功' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
