// Operational errors are safe to expose; anything else is answered with a generic 500.
class AppError extends Error {
  constructor(message, statusCode = 500, details = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = []) {
    return new AppError(message, 400, details);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }
}

export default AppError;
