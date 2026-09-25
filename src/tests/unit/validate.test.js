import { describe, expect, jest, test } from '@jest/globals';
import validate from '../../middlewares/validate.js';
import AppError from '../../utils/AppError.js';
import {
  createMediaSchema,
  listMediaSchema,
  updateMediaSchema,
} from '../../validators/mediaValidator.js';

const MEDIA_ID = '01a0e2ac-9fc6-7163-b7b0-8f9c54fb4123';

// Runs the middleware against a fake request and returns what it passed to next().
const run = (schema, req) => {
  const next = jest.fn();
  const request = { body: {}, query: {}, params: {}, ...req };
  validate(schema)(request, {}, next);
  return { request, next, error: next.mock.calls[0]?.[0] };
};

const fieldsOf = (error) => error.details.map((d) => d.field);

describe('validate middleware', () => {
  describe('valid input', () => {
    test('calls next() with no error and stores parsed values on req.validated', () => {
      const { request, next } = run(listMediaSchema, { query: {} });

      expect(next).toHaveBeenCalledWith();
      expect(request.validated.query).toEqual({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        order: 'desc',
      });
    });

    test('coerces and normalizes query strings', () => {
      const { request, error } = run(listMediaSchema, {
        query: {
          page: '2',
          limit: '5',
          category: 'image',
          tags: 'Beach, SUMMER,beach',
          order: 'ASC',
        },
      });

      expect(error).toBeUndefined();
      expect(request.validated.query).toMatchObject({
        page: 2,
        limit: 5,
        category: 'IMAGE',
        tags: ['beach', 'summer'],
        order: 'asc',
      });
    });

    test('accepts a multipart body with a file', () => {
      const body = Object.assign(Object.create(null), { title: ' Sunset ', category: 'IMAGE' });
      const { request, error } = run(createMediaSchema, { body, file: { path: 'uploads/a.png' } });

      expect(error).toBeUndefined();
      expect(request.validated.body).toEqual({ title: 'Sunset', tags: [], category: 'IMAGE' });
    });
  });

  describe('invalid input', () => {
    test('passes a structured 400 AppError to next()', () => {
      const { request, error } = run(listMediaSchema, { query: { page: '0', limit: '51' } });

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual(
        expect.arrayContaining([
          { field: 'page', message: 'Page must be at least 1' },
          { field: 'limit', message: 'Limit cannot exceed 50' },
        ]),
      );
      expect(request.validated).toBeUndefined();
    });

    test('reports every missing field, including the file', () => {
      const { error } = run(createMediaSchema, { body: {} });

      expect(fieldsOf(error)).toEqual(expect.arrayContaining(['title', 'category', 'file']));
    });

    test('reports each unknown field separately', () => {
      const { error } = run(updateMediaSchema, {
        params: { id: MEDIA_ID },
        body: { title: 'ok', filePath: '/etc/passwd', fileSize: 1 },
      });

      expect(error.details).toEqual([
        { field: 'filePath', message: "Unknown field 'filePath'" },
        { field: 'fileSize', message: "Unknown field 'fileSize'" },
      ]);
    });

    test('treats a missing req.body (Express 5 without a body parser) as an empty object', () => {
      const { error } = run(updateMediaSchema, { params: { id: MEDIA_ID }, body: undefined });

      expect(error.details).toEqual([
        { field: 'body', message: 'At least one of title, tags or category must be provided' },
      ]);
    });

    test('rejects a malformed id', () => {
      const { error } = run(updateMediaSchema, { params: { id: '123' }, body: { title: 'x' } });

      expect(error.details).toEqual([{ field: 'id', message: 'Media id must be a valid UUID' }]);
    });
  });
});
