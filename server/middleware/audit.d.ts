import { Request, Response, NextFunction } from 'express';
export declare function audit(action: string, resourceType?: string): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
