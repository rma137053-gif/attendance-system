"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStoreAdmin = requireStoreAdmin;
const errors_1 = require("../utils/errors");
function requireStoreAdmin(req, _res, next) {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'STORE_ADMIN')) {
        return next(new errors_1.ForbiddenError());
    }
    next();
}
