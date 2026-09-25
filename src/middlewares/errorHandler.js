import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

const normalizeError = (err) => {
  if (err instanceof AppError) return err;

  if (err.type === 'entity.parse.failed') {
    return AppError.badRequest('Malformed JSON in request body');
  }
  if (err.type === 'entity.too.large') {
    return new AppError('Request body is too large', 413);
  }

  const internal = new AppError('Something went wrong', 500);
  internal.isOperational = false;
  return internal;
};

// Express identifies error middleware by its four-argument signature.
const errorHandler = (err, req, res, next) => {
  // Response already streaming: let Express's default handler close the connection.
  if (res.headersSent) return next(err);

  const appError = normalizeError(err);
  const context = `${req.method} ${req.originalUrl} -> ${appError.statusCode}`;

  if (appError.isOperational) {
    logger.warn(`${context}: ${appError.message}`);
  } else {
    logger.error(`${context}: unhandled error`, err);
  }

  return sendError(res, appError);
};

export default errorHandler;
