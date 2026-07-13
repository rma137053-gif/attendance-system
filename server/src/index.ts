import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { ensureUploadDir } from './services/storage.service';
import { AppError } from './utils/errors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import recordRoutes from './routes/records';
import photoRoutes from './routes/photos';
import reportRoutes from './routes/reports';
import statsRoutes from './routes/stats';
import auditLogRoutes from './routes/auditLogs';

const app = express();

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} Content-Type: ${req.headers['content-type']}`);
  next();
});

// Ensure upload directory exists
ensureUploadDir();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error caught by handler:', err.name, err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Multer errors (file size, unexpected field, etc.)
  if (err.name === 'MulterError') {
    const multerErr = err as any;
    console.error('MulterError:', multerErr.code, multerErr.message, 'field:', multerErr.field);
    res.status(400).json({ error: multerErr.message || '文件上传错误' });
    return;
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const zodErr = err as any;
    const messages = zodErr.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
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

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Photo storage: ${config.storageType} (${config.uploadDir})`);
});

export default app;
