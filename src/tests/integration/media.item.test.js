import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { UPLOAD_DIR } from '../../config/storage.js';
import { clearUploads, fileExists, prisma, resetDatabase } from '../helpers/db.js';
import * as fixtures from '../helpers/fixtures.js';

const MISSING_ID = '01a0e2ac-0000-7000-8000-000000000000';

let media;

beforeEach(async () => {
  await resetDatabase();
  await clearUploads();
  const res = await request(app)
    .post('/media')
    .field('title', 'Original title')
    .field('tags', 'one,two')
    .field('category', 'IMAGE')
    .attach('file', fixtures.png(), { filename: 'item.png', contentType: 'image/png' });
  media = res.body.data.media;
});

afterAll(() => prisma.$disconnect());

describe('GET /media/:id', () => {
  test('200 for an existing id', async () => {
    const res = await request(app).get(`/media/${media.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', data: { media } });
  });

  test('404 for an id that does not exist', async () => {
    const res = await request(app).get(`/media/${MISSING_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'Media not found', details: [] });
  });

  test('400 for a malformed id', async () => {
    const res = await request(app).get('/media/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'id', message: 'Media id must be a valid UUID' }]);
  });
});

describe('PUT /media/:id', () => {
  test('200 for a valid update; file metadata is unchanged', async () => {
    const res = await request(app)
      .put(`/media/${media.id}`)
      .send({ title: 'New title', tags: ['New', 'new', 'Other'], category: 'document' });

    expect(res.status).toBe(200);
    expect(res.body.data.media).toMatchObject({
      id: media.id,
      title: 'New title',
      tags: ['new', 'other'],
      category: 'DOCUMENT',
      filePath: media.filePath,
      fileSize: media.fileSize,
    });
    expect(new Date(res.body.data.media.updatedAt) > new Date(media.updatedAt)).toBe(true);
  });

  test('200 for a partial update', async () => {
    const res = await request(app).put(`/media/${media.id}`).send({ title: 'Only title' });

    expect(res.body.data.media).toMatchObject({ title: 'Only title', tags: ['one', 'two'] });
  });

  test.each([
    ['an empty body', {}, ['body']],
    [
      'read-only fields',
      { title: 'ok', filePath: '/etc/passwd', fileSize: 1 },
      ['filePath', 'fileSize'],
    ],
    ['an invalid category', { category: 'MOVIE' }, ['category']],
    ['a blank title', { title: '   ' }, ['title']],
    ['wrongly typed tags', { tags: [1, 2] }, ['tags.0', 'tags.1']],
  ])('400 for %s', async (_case, body, fields) => {
    const res = await request(app).put(`/media/${media.id}`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.details.map((d) => d.field)).toEqual(fields);
  });

  test('400 for malformed JSON', async () => {
    const res = await request(app)
      .put(`/media/${media.id}`)
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Malformed JSON in request body');
  });

  test('413 for a JSON body over 100kb', async () => {
    const res = await request(app)
      .put(`/media/${media.id}`)
      .send({ title: 'x'.repeat(110 * 1024) });

    expect(res.status).toBe(413);
  });

  test('404 for an id that does not exist', async () => {
    const res = await request(app).put(`/media/${MISSING_ID}`).send({ title: 'x' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Media not found');
  });
});

describe('DELETE /media/:id', () => {
  test('200 for a successful deletion: removes the record and the file', async () => {
    expect(await fileExists(media.filePath)).toBe(true);

    const res = await request(app).delete(`/media/${media.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', data: null });
    expect(await prisma.media.findUnique({ where: { id: media.id } })).toBeNull();
    expect(await fileExists(media.filePath)).toBe(false);
  });

  test('404 for an id that does not exist', async () => {
    const res = await request(app).delete(`/media/${MISSING_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Media not found');
  });

  test('404 when deleting the same media twice', async () => {
    await request(app).delete(`/media/${media.id}`);
    const res = await request(app).delete(`/media/${media.id}`);

    expect(res.status).toBe(404);
  });

  test('400 for a malformed id', async () => {
    const res = await request(app).delete('/media/123');

    expect(res.status).toBe(400);
  });

  test('200 even when the file is already missing from disk', async () => {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(media.filePath)));

    const res = await request(app).delete(`/media/${media.id}`);

    expect(res.status).toBe(200);
    expect(await prisma.media.count()).toBe(0);
  });
});
