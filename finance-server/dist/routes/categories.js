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
const categoryService = __importStar(require("../services/category.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// ── GET /categories ──
router.get('/', async (req, res, next) => {
    try {
        const type = req.query.type;
        const storeId = req.query.storeId;
        const categories = await categoryService.listCategories(type, storeId);
        res.json(categories);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /categories ──
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '分类名称不能为空'),
    type: zod_1.z.enum(['INCOME', 'EXPENSE']),
    icon: zod_1.z.string().optional(),
    storeId: zod_1.z.string().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
router.post('/', (0, audit_1.audit)('CREATE', 'FinanceCategory'), async (req, res, next) => {
    try {
        const body = createSchema.parse(req.body);
        const category = await categoryService.createCategory(body);
        res.status(201).json(category);
    }
    catch (err) {
        next(err);
    }
});
// ── PUT /categories/:id ──
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    icon: zod_1.z.string().optional().nullable(),
    sortOrder: zod_1.z.number().int().optional(),
});
router.put('/:id', (0, audit_1.audit)('UPDATE', 'FinanceCategory'), async (req, res, next) => {
    try {
        const body = updateSchema.parse(req.body);
        const category = await categoryService.updateCategory(req.params.id, body);
        res.json(category);
    }
    catch (err) {
        next(err);
    }
});
// ── DELETE /categories/:id ──
router.delete('/:id', (0, audit_1.audit)('DELETE', 'FinanceCategory'), async (req, res, next) => {
    try {
        await categoryService.deleteCategory(req.params.id);
        res.json({ message: '删除成功' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map