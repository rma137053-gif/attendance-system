export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未登录或登录已过期') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '无权限访问') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(404, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}
