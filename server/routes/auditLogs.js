"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const requireAdmin_1 = require("../middleware/requireAdmin");
const timezone_1 = require("../utils/timezone");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, requireAdmin_1.requireAdmin);
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 30;
        const action = req.query.action;
        const where = {};
        if (action)
            where.action = { contains: action };
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.auditLog.count({ where }),
        ]);
        res.json({
            logs: logs.map((l) => ({
                ...l,
                createdAt: (0, timezone_1.formatBeijing)(l.createdAt),
            })),
            total,
            page,
            pageSize,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
