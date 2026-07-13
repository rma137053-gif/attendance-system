import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: string;
    role: string;
    storeId: string | null;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}
export declare function authMiddleware(req: Request, _res: Response, next: NextFunction): void;
