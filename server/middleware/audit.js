"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = audit;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function audit(action, resourceType) {
    return async (req, _res, next) => {
        // Capture response to log after it completes
        const originalJson = _res.json.bind(_res);
        _res.json = function (body) {
            const statusCode = _res.statusCode;
            if (statusCode >= 200 && statusCode < 300) {
                const resourceId = req.auditResourceId || req.params.id;
                prisma.auditLog
                    .create({
                    data: {
                        userId: req.user?.userId,
                        action,
                        resourceType: resourceType || undefined,
                        resourceId,
                        details: JSON.stringify({
                            method: req.method,
                            path: req.originalUrl,
                        }),
                    },
                })
                    .catch(() => { }); // fire-and-forget, don't block response
            }
            return originalJson(body);
        };
        next();
    };
}
