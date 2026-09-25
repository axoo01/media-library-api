import { describe, expect, jest, test } from '@jest/globals';
import catchAsync from '../../utils/catchAsync.js';

const req = {};
const res = {};

describe('catchAsync', () => {
  test('forwards a rejected promise to next(error)', async () => {
    const error = new Error('database down');
    const next = jest.fn();

    await catchAsync(async () => {
      throw error;
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('forwards an error thrown synchronously inside the handler', async () => {
    const error = new TypeError('bad input');
    const next = jest.fn();

    await catchAsync(() => {
      throw error;
    })(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  test('does not call next when the handler succeeds', async () => {
    const next = jest.fn();
    const handler = jest.fn(async () => 'done');

    await catchAsync(handler)(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
