import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { AppError } from './utils/errors';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.name, err.message);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(config.port, () => {
  console.log(`Tag server running on http://localhost:${config.port}`);
});

export default app;
