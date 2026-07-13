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
const auth_1 = require("../middleware/auth");
const reportService = __importStar(require("../services/report.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// ── GET /reports/summary ──
router.get('/summary', async (req, res, next) => {
    try {
        const result = await reportService.getSummary({
            storeId: req.query.storeId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /reports/monthly ──
router.get('/monthly', async (req, res, next) => {
    try {
        const result = await reportService.getMonthlyReport({
            storeId: req.query.storeId,
            year: req.query.year ? parseInt(req.query.year) : undefined,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /reports/by-category ──
router.get('/by-category', async (req, res, next) => {
    try {
        const result = await reportService.getCategoryReport({
            type: req.query.type,
            storeId: req.query.storeId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /reports/daily ──
router.get('/daily', async (req, res, next) => {
    try {
        const result = await reportService.getDailyTrend({
            type: req.query.type,
            storeId: req.query.storeId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /reports/export ──
router.get('/export', async (req, res, next) => {
    try {
        const csv = await reportService.exportCSV({
            type: req.query.type,
            storeId: req.query.storeId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=finance-export.csv');
        res.send(csv);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map