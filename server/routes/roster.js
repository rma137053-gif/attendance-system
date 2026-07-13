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
const requireStoreAdmin_1 = require("../middleware/requireStoreAdmin");
const audit_1 = require("../middleware/audit");
const rosterService = __importStar(require("../services/roster.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get today's roster for current user — any authenticated user
router.get('/today', async (req, res, next) => {
    try {
        const result = await rosterService.getTodayRoster(req.user.userId, req.user.storeId, req.user.role);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Query roster — any authenticated user (scoped by store)
router.get('/', async (req, res, next) => {
    try {
        const { storeId, startDate, endDate, userId } = req.query;
        const result = await rosterService.queryRoster({
            storeId: storeId,
            startDate: startDate,
            endDate: endDate,
            userId: userId,
            requesterUserId: req.user.userId,
            requesterRole: req.user.role,
        }, req.user.storeId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Batch upsert — STORE_ADMIN+
const batchSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1, '门店ID不能为空'),
    assignments: zod_1.z
        .array(zod_1.z.object({
        userId: zod_1.z.string().min(1, '员工ID不能为空'),
        shiftDate: zod_1.z.string().min(1, '排班日期不能为空'),
        startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, '开始时间格式错误（HH:mm）'),
        endTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, '结束时间格式错误（HH:mm）'),
        breakMinutes: zod_1.z.number().int().min(0).optional(),
    }))
        .min(1, '排班数据不能为空'),
});
router.post('/batch', requireStoreAdmin_1.requireStoreAdmin, (0, audit_1.audit)('BATCH_UPSE_ROSTER', 'Roster'), async (req, res, next) => {
    try {
        const body = batchSchema.parse(req.body);
        const result = await rosterService.batchUpsertRoster(body.storeId, body.assignments, req.user.storeId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// Delete — STORE_ADMIN+
router.delete('/:id', requireStoreAdmin_1.requireStoreAdmin, (0, audit_1.audit)('DELETE_ROSTER', 'Roster'), async (req, res, next) => {
    try {
        await rosterService.deleteRoster(req.params.id, req.user.storeId);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
