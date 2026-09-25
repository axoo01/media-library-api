import { describe, expect, test } from '@jest/globals';
import AppError from '../../utils/AppError.js';

describe('AppError', () => {
  test('sets message, statusCode and status', () => {
    const err = new AppError('Media not found', 404);

    expect(err.message).toBe('Media not found');
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe('error');
  });

  test('is a real Error marked as operational, with a stack trace', () => {
    const err = new AppError('Boom', 400);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
    expect(err.isOperational).toBe(true);
    expect(err.stack).toContain('AppError');
  });

  test('defaults to 500 with no details', () => {
    const err = new AppError('Something went wrong');

    expect(err.statusCode).toBe(500);
    expect(err.details).toEqual([]);
  });

  test('badRequest() creates a 400 carrying field-level details', () => {
    const details = [{ field: 'title', message: 'Title is required' }];
    const err = AppError.badRequest('Validation failed', details);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Validation failed');
    expect(err.details).toEqual(details);
  });

  test('notFound() creates a 404 with a default message', () => {
    const err = AppError.notFound();

    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Resource not found');
  });
});
