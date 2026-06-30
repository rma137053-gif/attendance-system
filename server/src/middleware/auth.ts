import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';

export interface AuthPayload {
  userId: string;
  role: string;
  storeId: string | null;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const prisma = new PrismaClient();

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;

    // Check tokenVersion — if user's email or password was changed, this will mismatch
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true, status: true },
    });

    if (!user || user.status === 'INACTIVE') {
      return next(new UnauthorizedError('账号已被停用'));
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return next(new UnauthorizedError('登录已失效，请重新登录'));
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    next(new UnauthorizedError('Token 无效或已过期'));
  }
}
