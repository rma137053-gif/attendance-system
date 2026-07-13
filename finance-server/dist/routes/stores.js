"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// ── GET /stores ──
router.get('/', async (_req, res, next) => {
    try {
        const stores = await prisma.store.findMany({ orderBy: { name: 'asc' } });
        res.json(stores);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /stores/:id ──
router.get('/:id', async (req, res, next) => {
    try {
        const store = await prisma.store.findUnique({ where: { id: req.params.id } });
        if (!store) {
            res.status(404).json({ error: '门店不存在' });
            return;
        }
        res.json(store);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=stores.js.map