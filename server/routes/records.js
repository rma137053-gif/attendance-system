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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const requireStoreAdmin_1 = require("../middleware/requireStoreAdmin");
const requireAdmin_1 = require("../middleware/requireAdmin");
const recordService = __importStar(require("../services/record.service"));
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        // Accept all images; also accept application/octet-stream as mobile browsers
        // may send camera captures without a proper MIME type
        const mime = file.mimetype || '';
        if (mime.startsWith('image/') || mime === 'application/octet-stream') {
            cb(null, true);
        }
        else {
            cb(new errors_1.BadRequestError('仅支持图片文件'));
        }
    },
});
function resolveClockUserId(req) {
    const role = req.user.role;
    const bodyUserId = req.body.userId;
    // ADMIN or STORE_ADMIN can clock on behalf of an employee
    if ((role === 'ADMIN' || role === 'STORE_ADMIN') && bodyUserId) {
        return bodyUserId;
    }
    return req.user.userId;
}
// Accept either multipart file upload or JSON with base64 photo
router.post('/clock-in', upload.single('photo'), async (req, res, next) => {
    try {
        let photoBuffer;
        let photoOriginalName;
        if (req.file) {
            // Multipart upload
            photoBuffer = req.file.buffer;
            photoOriginalName = req.file.originalname;
        }
        else if (req.body.photoBase64) {
            // JSON base64 upload (mobile-friendly)
            const base64 = req.body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
            photoBuffer = Buffer.from(base64, 'base64');
            photoOriginalName = req.body.photoName || 'photo.jpg';
        }
        const clockUserId = resolveClockUserId(req);
        const record = await recordService.createRecord({
            userId: clockUserId,
            type: 'CLOCK_IN',
            photoBuffer,
            photoOriginalName,
            requesterStoreId: clockUserId !== req.user.userId ? req.user.storeId : undefined,
        });
        res.status(201).json(record);
    }
    catch (err) {
        next(err);
    }
});
router.post('/clock-out', upload.single('photo'), async (req, res, next) => {
    try {
        let photoBuffer;
        let photoOriginalName;
        if (req.file) {
            photoBuffer = req.file.buffer;
            photoOriginalName = req.file.originalname;
        }
        else if (req.body.photoBase64) {
            const base64 = req.body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
            photoBuffer = Buffer.from(base64, 'base64');
            photoOriginalName = req.body.photoName || 'photo.jpg';
        }
        const clockUserId = resolveClockUserId(req);
        const record = await recordService.createRecord({
            userId: clockUserId,
            type: 'CLOCK_OUT',
            photoBuffer,
            photoOriginalName,
            requesterStoreId: clockUserId !== req.user.userId ? req.user.storeId : undefined,
        });
        res.status(201).json(record);
    }
    catch (err) {
        next(err);
    }
});
// STORE_ADMIN+ can view records
router.get('/', requireStoreAdmin_1.requireStoreAdmin, async (req, res, next) => {
    try {
        const isGlobalAdmin = req.user.role === 'ADMIN' && !req.user.storeId;
        const { userId, startDate, endDate, type, page, pageSize, storeId, anomalous } = req.query;
        const filterUserId = userId;
        const effectiveStoreId = isGlobalAdmin
            ? storeId || null
            : req.user.storeId;
        const result = await recordService.queryRecords({
            userId: filterUserId,
            startDate: startDate,
            endDate: endDate,
            type: type,
            page: page ? parseInt(page) : undefined,
            pageSize: pageSize ? parseInt(pageSize) : undefined,
            anomalous: anomalous === 'true' ? true : anomalous === 'false' ? false : undefined,
        }, effectiveStoreId, req.user.role);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ADMIN only: toggle anomaly status of a record
router.patch('/:id/anomaly', requireAdmin_1.requireAdmin, async (req, res, next) => {
    try {
        const record = await recordService.toggleAnomaly(req.params.id, req.user.storeId);
        res.json(record);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
