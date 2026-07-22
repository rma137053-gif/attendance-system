export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) { super(message, 400); }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未登录') { super(message, 401); }
}

export class ForbiddenError extends AppError {
  constructor(message = '无权限') { super(message, 403); }
}

export class NotFoundError extends AppError {
  constructor(message = '不存在') { super(message, 404); }
}
