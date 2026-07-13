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
const recordService = __importStar(require("../services/record.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// ── GET /records ──
router.get('/', async (req, res, next) => {
    try {
        const result = await recordService.listRecords({
            type: req.query.type,
            storeId: req.query.storeId,
            categoryId: req.query.categoryId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            status: req.query.status,
            keyword: req.query.keyword,
            page: parseInt(req.query.page) || 1,
            pageSize: Math.min(parseInt(req.query.pageSize) || 20, 100),
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /records/:id ──
router.get('/:id', async (req, res, next) => {
    try {
        const record = await recordService.getRecord(req.params.id);
        res.json(record);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /records ──
const createSchema = zod_1.z.object({
    type: zod_1.z.enum(['INCOME', 'EXPENSE']),
    amount: zod_1.z.number().positive('金额必须大于0'),
    categoryId: zod_1.z.string().min(1, '分类不能为空'),
    storeId: zod_1.z.string().min(1, '门店不能为空'),
    date: zod_1.z.string().min(1, '日期不能为空'),
    description: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.enum(['CASH', 'WECHAT', 'ALIPAY', 'BANK_CARD', 'TRANSFER', 'OTHER']).optional(),
    referenceType: zod_1.z.string().optional(),
    referenceId: zod_1.z.string().optional(),
});
router.post('/', (0, audit_1.audit)('CREATE', 'FinanceRecord'), async (req, res, next) => {
    try {
        const body = createSchema.parse(req.body);
        const record = await recordService.createRecord(body);
        res.status(201).json(record);
    }
    catch (err) {
        next(err);
    }
});
// ── PUT /records/:id ──
const updateSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('金额必须大于0').optional(),
    categoryId: zod_1.z.string().min(1).optional(),
    date: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional().nullable(),
    paymentMethod: zod_1.z.enum(['CASH', 'WECHAT', 'ALIPAY', 'BANK_CARD', 'TRANSFER', 'OTHER']).optional().nullable(),
    referenceType: zod_1.z.string().optional().nullable(),
    referenceId: zod_1.z.string().optional().nullable(),
});
router.put('/:id', (0, audit_1.audit)('UPDATE', 'FinanceRecord'), async (req, res, next) => {
    try {
        const body = updateSchema.parse(req.body);
        const record = await recordService.updateRecord(req.params.id, body);
        res.json(record);
    }
    catch (err) {
        next(err);
    }
});
// ── DELETE /records/:id ──
router.delete('/:id', (0, audit_1.audit)('DELETE', 'FinanceRecord'), async (req, res, next) => {
    try {
        await recordService.deleteRecord(req.params.id);
        res.json({ message: '删除成功' });
    }
    catch (err) {
        next(err);
    }
});
// ── POST /records/:id/review ──
const reviewSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    reviewNote: zod_1.z.string().optional(),
});
router.post('/:id/review', (0, audit_1.audit)('REVIEW', 'FinanceRecord'), async (req, res, next) => {
    try {
        const body = reviewSchema.parse(req.body);
        const record = await recordService.reviewRecord(req.params.id, body.status, req.user.userId, body.reviewNote);
        res.json(record);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /records/batch-review ──
const batchReviewSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string()).min(1, '请选择记录'),
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    reviewNote: zod_1.z.string().optional(),
});
router.post('/batch-review', (0, audit_1.audit)('BATCH_REVIEW', 'FinanceRecord'), async (req, res, next) => {
    try {
        const body = batchReviewSchema.parse(req.body);
        const result = await recordService.batchReview(body.ids, body.status, req.user.userId, body.reviewNote);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=records.js.map