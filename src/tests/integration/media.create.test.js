import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { clearUploads, fileExists, prisma, resetDatabase, uploadedFiles } from '../helpers/db.js';
import * as fixtures from '../helpers/fixtures.js';

const VALID_FIELDS = { title: 'Summer beach', tags: 'Beach, SUMMER,beach', category: 'image' };

const post = (url, { fields = {}, files = [] }) => {
  let req = request(app).post(url);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  for (const { field = 'file', buffer, filename, contentType } of files) {
    req = req.attach(field, buffer, { filename, contentType });
  }
  return req;
};

const pngFile = (overrides = {}) => ({
  buffer: fixtures.png(),
  filename: 'beach.png',
  contentType: 'image/png',
  ...overrides,
});

const expectValidationError = (res, message, fields) => {
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ status: 'error', message });
  expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(fields));
};

beforeEach(async () => {
  await resetDatabase();
  await clearUploads();
});

afterAll(() => prisma.$disconnect());

describe('POST /media', () => {
  test('201 for a valid upload: stores metadata and the file', async () => {
    const res = await post('/media', { fields: VALID_FIELDS, files: [pngFile()] });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    const { media } = res.body.data;
    expect(media).toMatchObject({
      title: 'Summer beach',
      tags: ['beach', 'summer'],
      category: 'IMAGE',
      originalName: 'beach.png',
      mimeType: 'image/png',
      fileSize: 256,
    });
    expect(media.filePath).toMatch(/^tmp\/test-uploads\/[0-9a-f-]{36}\.png$/);
    expect(await fileExists(media.filePath)).toBe(true);
    expect(await prisma.media.count()).toBe(1);
  });

  test.each([
    ['JPEG', fixtures.jpg(), 'photo.jpg', 'image/jpeg'],
    ['PDF', fixtures.pdf(), 'report.pdf', 'application/pdf'],
  ])('201 for a valid %s', async (_type, buffer, filename, contentType) => {
    const res = await post('/media', {
      fields: { title: 'Doc', category: 'DOCUMENT' },
      files: [{ buffer, filename, contentType }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.media.mimeType).toBe(contentType);
  });

  test('400 for a missing title, and the uploaded file is removed', async () => {
    const res = await post('/media', { fields: { category: 'IMAGE' }, files: [pngFile()] });

    expectValidationError(res, 'Validation failed', ['title']);
    expect(res.body.details).toContainEqual({ field: 'title', message: 'Title is required' });
    expect(await uploadedFiles()).toEqual([]);
    expect(await prisma.media.count()).toBe(0);
  });

  test('400 for an unsupported file type', async () => {
    const res = await post('/media', {
      fields: VALID_FIELDS,
      files: [{ buffer: fixtures.text(), filename: 'notes.txt', contentType: 'text/plain' }],
    });

    expectValidationError(res, 'Unsupported file type', ['file']);
    expect(await uploadedFiles()).toEqual([]);
  });

  test('400 for a spoofed file type (text declared as PNG)', async () => {
    const res = await post('/media', {
      fields: VALID_FIELDS,
      files: [pngFile({ buffer: fixtures.text() })],
    });

    expectValidationError(res, 'Unsupported file type', ['file']);
    expect(res.body.details[0].message).toMatch(/does not match its declared type/);
    expect(await uploadedFiles()).toEqual([]);
  });

  test('400 for a file over MAX_FILE_SIZE_MB', async () => {
    const res = await post('/media', {
      fields: VALID_FIELDS,
      files: [pngFile({ buffer: fixtures.oversizedPng() })],
    });

    expectValidationError(res, 'File exceeds the 5MB size limit', ['file']);
    expect(await uploadedFiles()).toEqual([]);
  });

  test('400 when the file is missing', async () => {
    const res = await post('/media', { fields: VALID_FIELDS });

    expectValidationError(res, 'Validation failed', ['file']);
  });

  test('400 for an invalid category and unknown fields', async () => {
    const res = await post('/media', {
      fields: { title: 'x', category: 'MOVIE', filePath: '/etc/passwd' },
      files: [pngFile()],
    });

    expectValidationError(res, 'Validation failed', ['category', 'filePath']);
    expect(await uploadedFiles()).toEqual([]);
  });

  test('400 for a file sent under the wrong field name', async () => {
    const res = await post('/media', {
      fields: VALID_FIELDS,
      files: [pngFile({ field: 'image' })],
    });

    expectValidationError(res, 'Unexpected file field, or too many files for this field', [
      'image',
    ]);
  });

  test('400 for more than one file on the single-upload endpoint', async () => {
    const res = await post('/media', { fields: VALID_FIELDS, files: [pngFile(), pngFile()] });

    expect(res.status).toBe(400);
    expect(await uploadedFiles()).toEqual([]);
  });
});

describe('POST /media/bulk', () => {
  const bulkFile = (filename, buffer = fixtures.png()) =>
    pngFile({ field: 'files', filename, buffer });

  test('201 for several files: one record each, titles from filenames', async () => {
    const res = await post('/media/bulk', {
      fields: { tags: 'batch', category: 'OTHER' },
      files: [bulkFile('mountain-view.png'), bulkFile('city night.png')],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.results.map((r) => r.title).sort()).toEqual([
      'city night',
      'mountain-view',
    ]);
    expect(await prisma.media.count()).toBe(2);
    expect(await uploadedFiles()).toHaveLength(2);
  });

  test('400 when no files are sent', async () => {
    const res = await post('/media/bulk', { fields: { category: 'OTHER' } });

    expectValidationError(res, 'Validation failed', ['files']);
  });

  test('400 for more than 5 files', async () => {
    const files = Array.from({ length: 6 }, (_, i) => bulkFile(`f${i}.png`));
    const res = await post('/media/bulk', { fields: { category: 'OTHER' }, files });

    expectValidationError(res, 'A maximum of 5 files is allowed', ['files']);
    expect(await uploadedFiles()).toEqual([]);
  });

  test('one invalid file rejects the whole batch and leaves nothing behind', async () => {
    const res = await post('/media/bulk', {
      fields: { category: 'OTHER' },
      files: [bulkFile('ok.png'), bulkFile('fake.png', fixtures.text())],
    });

    expect(res.status).toBe(400);
    expect(await prisma.media.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });
});
