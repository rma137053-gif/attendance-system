"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const storage_service_1 = require("./services/storage.service");
const scheduler_1 = require("./jobs/scheduler");
const errors_1 = require("./utils/errors");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const records_1 = __importDefault(require("./routes/records"));
const photos_1 = __importDefault(require("./routes/photos"));
const reports_1 = __importDefault(require("./routes/reports"));
const stats_1 = __importDefault(require("./routes/stats"));
const auditLogs_1 = __importDefault(require("./routes/auditLogs"));
const roster_1 = __importDefault(require("./routes/roster"));
const handover_1 = __importDefault(require("./routes/handover"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Request logger
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} Content-Type: ${req.headers['content-type']}`);
    next();
});
// Ensure upload directory exists
(0, storage_service_1.ensureUploadDir)();
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/records', records_1.default);
app.use('/api/photos', photos_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/audit-logs', auditLogs_1.default);
app.use('/api/roster', roster_1.default);
app.use('/api/handover', handover_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Error caught by handler:', err.name, err.message);
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }
    // Multer errors (file size, unexpected field, etc.)
    if (err.name === 'MulterError') {
        const multerErr = err;
        console.error('MulterError:', multerErr.code, multerErr.message, 'field:', multerErr.field);
        res.status(400).json({ error: multerErr.message || '文件上传错误' });
        return;
    }
    // Zod validation errors
    if (err.name === 'ZodError') {
        const zodErr = err;
        const messages = zodErr.errors?.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        res.status(400).json({ error: messages || '请求参数错误' });
        return;
    }
    // Other known error messages (e.g. from multer fileFilter)
    if (err.message) {
        res.status(400).json({ error: err.message });
        return;
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: '服务器内部错误' });
});
app.listen(config_1.config.port, () => {
    console.log(`Server running on http://localhost:${config_1.config.port}`);
    console.log(`Photo storage: ${config_1.config.storageType} (${config_1.config.uploadDir})`);
    (0, scheduler_1.startScheduler)();
});
exports.default = app;
