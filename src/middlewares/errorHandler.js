import multer from 'multer';
import { Prisma } from '../generated/prisma/client.ts';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';
import { cleanupUploadedFiles } from './upload.js';
import { MAX_BULK_FILES, MAX_FILE_SIZE } from '../models/Media.js';

const PRISMA_ERROR_MAP = {
  P2025: () => AppError.notFound('Media not found'),
  P2002: (err) =>
    new AppError('Resource already exists', 409, [
      { field: String(err.meta?.target ?? 'unknown'), message: 'Must be unique' },
    ]),
};

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB size limit`,
  LIMIT_FILE_COUNT: `A maximum of ${MAX_BULK_FILES} files is allowed`,
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field, or too many files for this field',
};

const normalizeError = (err) => {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    const message = MULTER_MESSAGES[err.code] ?? err.message;
    // LIMIT_FILE_COUNT carries no field and is only reachable on the multi-file endpoint.
    const field = err.field ?? (err.code === 'LIMIT_FILE_COUNT' ? 'files' : 'file');
    return AppError.badRequest(message, [{ field, message }]);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERROR_MAP[err.code]) {
    return PRISMA_ERROR_MAP[err.code](err);
  }

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
const errorHandler = async (err, req, res, next) => {
  // Response already streaming: let Express's default handler close the connection.
  if (res.headersSent) return next(err);

  await cleanupUploadedFiles(req);

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
