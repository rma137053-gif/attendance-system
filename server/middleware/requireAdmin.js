"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const errors_1 = require("../utils/errors");
function requireAdmin(req, _res, next) {
    if (!req.user || req.user.role !== 'ADMIN') {
        return next(new errors_1.ForbiddenError());
    }
    next();
}
