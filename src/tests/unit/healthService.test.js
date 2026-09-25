import { describe, expect, jest, test } from '@jest/globals';

const healthRepository = { pingDatabase: jest.fn() };
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../repositories/healthRepository.js', () => healthRepository);
jest.unstable_mockModule('../../utils/logger.js', () => ({ default: logger }));

const { checkHealth } = await import('../../services/healthService.js');

describe('healthService.checkHealth', () => {
  test('reports ok with uptime and an ISO timestamp when the database answers', async () => {
    healthRepository.pingDatabase.mockResolvedValue([{ '?column?': 1 }]);

    const health = await checkHealth();

    expect(health).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(new Date(health.timestamp).toISOString()).toBe(health.timestamp);
  });

  test('reports an error and logs it when the database is unreachable', async () => {
    const err = new Error('ECONNREFUSED');
    healthRepository.pingDatabase.mockRejectedValue(err);

    const health = await checkHealth();

    expect(health).toMatchObject({ status: 'error', message: 'Database unreachable' });
    expect(logger.error).toHaveBeenCalledWith({ err }, 'Health check failed: database unreachable');
  });

  test('gives up after the timeout when the database never answers', async () => {
    healthRepository.pingDatabase.mockReturnValue(new Promise(() => {}));
    const started = Date.now();

    const health = await checkHealth();

    expect(health.status).toBe('error');
    expect(Date.now() - started).toBeGreaterThanOrEqual(1900);
    expect(logger.error.mock.calls[0][0].err.message).toMatch(/did not respond within 2000ms/);
  });
});
