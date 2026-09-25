import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { insertMedia, prisma, resetDatabase } from '../helpers/db.js';

// Mixed-case titles, a shared fileSize and a shared createdAt exercise sorting and tie-breakers.
const SEED = [
  {
    title: 'Summer beach sunset',
    category: 'IMAGE',
    tags: ['beach', 'summer', 'travel'],
    fileSize: 20480,
    createdAt: new Date('2026-09-01T09:00:00Z'),
  },
  {
    title: 'annual report 2025',
    category: 'DOCUMENT',
    tags: ['finance', 'report'],
    fileSize: 10240,
    createdAt: new Date('2026-09-02T09:00:00Z'),
  },
  {
    title: 'Brand guidelines',
    category: 'DOCUMENT',
    tags: ['branding', 'design'],
    fileSize: 10240,
    createdAt: new Date('2026-09-03T09:00:00Z'),
  },
  {
    title: 'podcast cover art',
    category: 'AUDIO',
    tags: ['podcast', 'marketing'],
    fileSize: 5120,
    createdAt: new Date('2026-09-03T09:00:00Z'),
  },
  {
    title: 'City skyline night',
    category: 'IMAGE',
    tags: ['city', 'night', 'travel'],
    fileSize: 30720,
    createdAt: new Date('2026-09-04T09:00:00Z'),
  },
  {
    title: 'Café menu',
    category: 'OTHER',
    tags: ['food'],
    fileSize: 2048,
    createdAt: new Date('2026-09-05T09:00:00Z'),
  },
];

const list = (query = {}) => request(app).get('/media').query(query);
const titles = (res) => res.body.data.results.map((r) => r.title);

beforeAll(async () => {
  await resetDatabase();
  await insertMedia(SEED);
});

afterAll(() => prisma.$disconnect());

describe('GET /media pagination', () => {
  test('returns results with pagination metadata and default page/limit', async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.results).toHaveLength(6);
    expect(res.body.data.pagination).toEqual({ total: 6, page: 1, limit: 10, totalPages: 1 });
  });

  test('slices results with page and limit', async () => {
    const res = await list({ page: 2, limit: 4 });

    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.pagination).toEqual({ total: 6, page: 2, limit: 4, totalPages: 2 });
  });

  test('a page beyond the last returns 200 with empty results', async () => {
    const res = await list({ page: 99, limit: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      results: [],
      pagination: { total: 6, page: 99, limit: 4, totalPages: 2 },
    });
  });

  test('pages never repeat or skip records when sort values tie', async () => {
    const full = (await list({ sortBy: 'fileSize', limit: 50 })).body.data.results.map((r) => r.id);
    const paged = [];
    for (const page of [1, 2, 3]) {
      const res = await list({ sortBy: 'fileSize', limit: 2, page });
      paged.push(...res.body.data.results.map((r) => r.id));
    }

    expect(paged).toEqual(full);
    expect(new Set(paged).size).toBe(6);
  });
});

describe('GET /media filtering and search', () => {
  test('filters by category (case-insensitive input)', async () => {
    const res = await list({ category: 'document', sortBy: 'title', order: 'asc' });

    expect(titles(res)).toEqual(['annual report 2025', 'Brand guidelines']);
    expect(res.body.data.pagination.total).toBe(2);
  });

  test('filters by tags, matching any of the comma-separated tags', async () => {
    const res = await list({ tags: 'travel,podcast', sortBy: 'title', order: 'asc' });

    expect(titles(res)).toEqual(['City skyline night', 'podcast cover art', 'Summer beach sunset']);
  });

  test('tag filtering is case-insensitive', async () => {
    const res = await list({ tags: 'FINANCE' });

    expect(titles(res)).toEqual(['annual report 2025']);
  });

  test('search matches title substrings case-insensitively', async () => {
    const res = await list({ search: 'NIGHT' });

    expect(titles(res)).toEqual(['City skyline night']);
  });

  test('search handles non-ASCII text', async () => {
    const res = await list({ search: 'CAFÉ' });

    expect(titles(res)).toEqual(['Café menu']);
  });

  test('combines filters, search and pagination', async () => {
    const res = await list({
      category: 'IMAGE',
      tags: 'travel',
      search: 's',
      limit: 1,
      page: 2,
      sortBy: 'title',
    });

    expect(res.body.data.pagination).toEqual({ total: 2, page: 2, limit: 1, totalPages: 2 });
  });

  test('returns empty results when nothing matches', async () => {
    const res = await list({ category: 'VIDEO' });

    expect(res.body.data).toEqual({
      results: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });
});

describe('GET /media sorting', () => {
  test('sorts titles alphabetically regardless of case', async () => {
    const res = await list({ sortBy: 'title', order: 'asc' });

    expect(titles(res)).toEqual([
      'annual report 2025',
      'Brand guidelines',
      'Café menu',
      'City skyline night',
      'podcast cover art',
      'Summer beach sunset',
    ]);
  });

  test('defaults to newest first', async () => {
    const res = await list();

    expect(titles(res)[0]).toBe('Café menu');
    expect(titles(res).at(-1)).toBe('Summer beach sunset');
  });
});

describe('GET /media invalid query parameters', () => {
  test('400 with a detail for each invalid parameter', async () => {
    const res = await list({ page: 0, limit: 51, sortBy: 'password', order: 'up' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.details.map((d) => d.field).sort()).toEqual([
      'limit',
      'order',
      'page',
      'sortBy',
    ]);
  });

  test('400 for unknown parameters', async () => {
    const res = await list({ foo: 'bar' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'foo', message: "Unknown field 'foo'" }]);
  });
});
