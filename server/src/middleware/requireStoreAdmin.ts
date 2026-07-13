import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

export function requireStoreAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'STORE_ADMIN')) {
    return next(new ForbiddenError());
  }
  next();
}
