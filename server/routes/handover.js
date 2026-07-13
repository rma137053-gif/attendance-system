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
const handoverService = __importStar(require("../services/handover.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
const createSchema = zod_1.z.object({
    rosterId: zod_1.z.string().min(1, '排班ID不能为空'),
    content: zod_1.z.string().min(1, '备注内容不能为空').max(500, '备注内容不能超过500字'),
});
// Create handover note
router.post('/', (0, audit_1.audit)('CREATE_HANDOVER', 'HandoverNote'), async (req, res, next) => {
    try {
        const body = createSchema.parse(req.body);
        const note = await handoverService.createHandoverNote(body.rosterId, req.user.userId, body.content, req.user.storeId);
        res.status(201).json(note);
    }
    catch (err) {
        next(err);
    }
});
// List handover notes for a roster
router.get('/:rosterId', async (req, res, next) => {
    try {
        const notes = await handoverService.listHandoverNotes(req.params.rosterId, req.user.storeId);
        res.json(notes);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
