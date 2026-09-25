import { afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../helpers/db.js';

afterAll(() => prisma.$disconnect());

describe('GET /health', () => {
  test('200 with { status: "ok", uptime, timestamp } when the database is reachable', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['status', 'timestamp', 'uptime']);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('app-wide behaviour', () => {
  test('404 in the standard envelope for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Route GET /does-not-exist not found',
      details: [],
    });
  });

  test('generates a request id and returns it in the response header', async () => {
    const res = await request(app).get('/media');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('reuses a safe incoming x-request-id for tracing', async () => {
    const res = await request(app).get('/media').set('x-request-id', 'trace-123');

    expect(res.headers['x-request-id']).toBe('trace-123');
  });

  test('replaces an unsafe incoming x-request-id', async () => {
    const res = await request(app).get('/media').set('x-request-id', 'bad id"with quotes');

    expect(res.headers['x-request-id']).not.toBe('bad id"with quotes');
  });

  test('does not advertise the framework', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
