import { describe, expect, test } from '@jest/globals';
import { EnvValidationError, parseEnv } from '../../config/env.js';

const validEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/media_library',
  JWT_SECRET: 'x'.repeat(32),
  MAX_FILE_SIZE_MB: '5',
  UPLOAD_DIR: 'uploads',
  LOG_LEVEL: 'info',
};

const problemsFor = (source) => {
  try {
    parseEnv(source);
  } catch (err) {
    expect(err).toBeInstanceOf(EnvValidationError);
    return err.problems;
  }
  throw new Error('Expected parseEnv to throw');
};

describe('parseEnv (startup validation)', () => {
  test('returns typed, frozen config for a valid environment', () => {
    const env = parseEnv(validEnv);

    expect(env).toMatchObject({
      PORT: 3000,
      MAX_FILE_SIZE_MB: 5,
      isProduction: true,
      isTest: false,
    });
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(10000);
    expect(Object.isFrozen(env)).toBe(true);
  });

  test('names every missing required variable', () => {
    expect(problemsFor({ NODE_ENV: 'development' })).toEqual([
      'PORT is required but not set',
      'DATABASE_URL is required but not set',
      'JWT_SECRET is required but not set',
      'MAX_FILE_SIZE_MB is required but not set',
      'UPLOAD_DIR is required but not set',
      'LOG_LEVEL is required but not set',
    ]);
  });

  test('treats blank values as missing', () => {
    expect(problemsFor({ ...validEnv, JWT_SECRET: '   ' })).toEqual([
      'JWT_SECRET is required but not set',
    ]);
  });

  test('describes invalid values', () => {
    const problems = problemsFor({
      ...validEnv,
      DATABASE_URL: 'mysql://localhost/db',
      JWT_SECRET: 'short',
      LOG_LEVEL: 'verbose',
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        'DATABASE_URL: Must be a PostgreSQL connection URL',
        'JWT_SECRET: Must be at least 32 characters',
        expect.stringMatching(/^LOG_LEVEL: /),
      ]),
    );
  });

  test('refuses to run tests against a database not ending in _test', () => {
    expect(problemsFor({ ...validEnv, NODE_ENV: 'test' })).toEqual([
      'DATABASE_URL: In test, must point to a database whose name ends with "_test"',
    ]);
  });

  test('accepts a _test database in the test environment', () => {
    const env = parseEnv({
      ...validEnv,
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user@localhost:5432/media_library_test',
    });

    expect(env.isTest).toBe(true);
  });
});
