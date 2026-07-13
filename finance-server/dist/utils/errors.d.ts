export declare class AppError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
export declare class BadRequestError extends AppError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map