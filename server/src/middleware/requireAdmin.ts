import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new ForbiddenError());
  }
  next();
}
