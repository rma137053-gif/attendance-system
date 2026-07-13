"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const errors_1 = require("./utils/errors");
const auth_1 = __importDefault(require("./routes/auth"));
const categories_1 = __importDefault(require("./routes/categories"));
const records_1 = __importDefault(require("./routes/records"));
const reports_1 = __importDefault(require("./routes/reports"));
const stores_1 = __importDefault(require("./routes/stores"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Request logger
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/records', records_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/stores', stores_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Error:', err.name, err.message);
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }
    if (err.name === 'ZodError') {
        const zodErr = err;
        const messages = zodErr.errors?.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        res.status(400).json({ error: messages || '请求参数错误' });
        return;
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: '服务器内部错误' });
});
app.listen(config_1.config.port, () => {
    console.log(`Finance server running on http://localhost:${config_1.config.port}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map