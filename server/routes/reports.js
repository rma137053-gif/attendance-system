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
const requireAdmin_1 = require("../middleware/requireAdmin");
const reportService = __importStar(require("../services/report.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, requireAdmin_1.requireAdmin);
function getStoreId(req) {
    // Global admin can filter by store; store-scoped admin uses their own storeId
    if (!req.user.storeId) {
        return req.query.storeId || null;
    }
    return req.user.storeId;
}
router.get('/weekly', async (req, res, next) => {
    try {
        const rows = await reportService.getWeeklyReport(getStoreId(req), req.query.date);
        const summary = reportService.generateSummary(rows);
        res.json({ rows, summary });
    }
    catch (err) {
        next(err);
    }
});
router.get('/monthly', async (req, res, next) => {
    try {
        const rows = await reportService.getMonthlyReport(getStoreId(req), req.query.month);
        const summary = reportService.generateSummary(rows);
        res.json({ rows, summary });
    }
    catch (err) {
        next(err);
    }
});
router.get('/yearly', async (req, res, next) => {
    try {
        const rows = await reportService.getYearlyReport(getStoreId(req), req.query.year);
        const summary = reportService.generateSummary(rows);
        res.json({ rows, summary });
    }
    catch (err) {
        next(err);
    }
});
router.get('/export', async (req, res, next) => {
    try {
        const type = req.query.type;
        const storeId = getStoreId(req);
        let rows;
        let filename;
        if (type === 'weekly') {
            rows = await reportService.getWeeklyReport(storeId, req.query.date);
            filename = `周报_${rows[0]?.weekStart?.slice(0, 10) || 'export'}.csv`;
        }
        else if (type === 'monthly') {
            rows = await reportService.getMonthlyReport(storeId, req.query.month);
            filename = `月报_${rows[0]?.month || 'export'}.csv`;
        }
        else if (type === 'yearly') {
            rows = await reportService.getYearlyReport(storeId, req.query.year);
            filename = `年报_${rows[0]?.year || 'export'}.csv`;
        }
        else {
            res.status(400).json({ error: 'type 参数必须为 weekly、monthly 或 yearly' });
            return;
        }
        const csv = reportService.generateCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.send('﻿' + csv);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
