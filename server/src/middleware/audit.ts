import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function audit(action: string, resourceType?: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Capture response to log after it completes
    const originalJson = _res.json.bind(_res);
    _res.json = function (body: unknown) {
      const statusCode = _res.statusCode;
      if (statusCode >= 200 && statusCode < 300) {
        const resourceId = (req as any).auditResourceId || req.params.id;
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
          .catch(() => {}); // fire-and-forget, don't block response
      }
      return originalJson(body);
    };
    next();
  };
}
