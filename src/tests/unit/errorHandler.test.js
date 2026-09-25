import { describe, expect, jest, test } from '@jest/globals';
import multer from 'multer';
import AppError from '../../utils/AppError.js';

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const cleanupUploadedFiles = jest.fn(async () => {});

jest.unstable_mockModule('../../utils/logger.js', () => ({ default: logger }));
jest.unstable_mockModule('../../middlewares/upload.js', () => ({ cleanupUploadedFiles }));

const { default: errorHandler } = await import('../../middlewares/errorHandler.js');
const { Prisma } = await import('../../generated/prisma/client.ts');

const prismaError = (code, meta) =>
  new Prisma.PrismaClientKnownRequestError('prisma error', { code, clientVersion: '7.10.0', meta });

const handle = async (err, { headersSent = false } = {}) => {
  const res = {
    headersSent,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const req = { method: 'GET', originalUrl: '/media' };
  const next = jest.fn();
  await errorHandler(err, req, res, next);
  return { req, res, next };
};

describe('errorHandler', () => {
  test('passes AppErrors through in the standard envelope and logs a warning', async () => {
    const details = [{ field: 'title', message: 'Title is required' }];
    const { res } = await handle(AppError.badRequest('Validation failed', details));

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ status: 'error', message: 'Validation failed', details });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ details }),
      'Validation failed',
    );
  });

  test('logs 404s as "Resource not found" warnings', async () => {
    await handle(AppError.notFound('Media not found'));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
      'Resource not found: Media not found',
    );
  });

  test.each([
    ['LIMIT_FILE_SIZE', 'file', 'file', 'File exceeds the 5MB size limit'],
    [
      'LIMIT_UNEXPECTED_FILE',
      'image',
      'image',
      'Unexpected file field, or too many files for this field',
    ],
    ['LIMIT_FILE_COUNT', undefined, 'files', 'A maximum of 5 files is allowed'],
    ['LIMIT_FIELD_COUNT', undefined, 'file', 'Too many fields'],
  ])('maps Multer %s to a 400 on field "%s"', async (code, field, expectedField, message) => {
    const { res } = await handle(new multer.MulterError(code, field));

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      status: 'error',
      message,
      details: [{ field: expectedField, message }],
    });
  });

  test('maps Prisma P2025 (record not found) to 404', async () => {
    const { res } = await handle(prismaError('P2025'));

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Media not found');
  });

  test('maps Prisma P2002 (unique constraint) to 409 naming the field', async () => {
    const { res } = await handle(prismaError('P2002', { target: ['filePath'] }));

    expect(res.statusCode).toBe(409);
    expect(res.body.details).toEqual([{ field: 'filePath', message: 'Must be unique' }]);
  });

  test('maps body-parser errors to 400 and 413', async () => {
    const malformed = await handle(
      Object.assign(new SyntaxError('bad json'), { type: 'entity.parse.failed' }),
    );
    const tooLarge = await handle(
      Object.assign(new Error('too large'), { type: 'entity.too.large' }),
    );

    expect(malformed.res.statusCode).toBe(400);
    expect(tooLarge.res.statusCode).toBe(413);
  });

  test.each([
    ['an unexpected error', new TypeError("Cannot read properties of undefined (reading 'id')")],
    ['an unmapped Prisma error', prismaError('P2003')],
  ])('answers %s with a generic 500 and logs it at error level', async (_case, err) => {
    const { res } = await handle(err);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 'error', message: 'Something went wrong', details: [] });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err }), 'Unhandled error');
  });

  test('removes uploaded files before responding', async () => {
    const { req } = await handle(AppError.badRequest('Validation failed'));

    expect(cleanupUploadedFiles).toHaveBeenCalledWith(req);
  });

  test('delegates to Express when the response has already started', async () => {
    const err = new Error('late failure');
    const { res, next } = await handle(err, { headersSent: true });

    expect(next).toHaveBeenCalledWith(err);
    expect(res.body).toBeUndefined();
    expect(cleanupUploadedFiles).not.toHaveBeenCalled();
  });
});
