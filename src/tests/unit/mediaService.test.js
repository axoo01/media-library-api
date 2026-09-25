import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AppError from '../../utils/AppError.js';

const mediaRepository = {
  create: jest.fn(),
  createMany: jest.fn(),
  findById: jest.fn(),
  findAndCount: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
};
const fileRepository = {
  toStoredPath: jest.fn((absolutePath) => `uploads/${absolutePath.split('/').pop()}`),
  removeFile: jest.fn(),
};
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

// ESM mocks must be registered before the module under test is imported.
jest.unstable_mockModule('../../repositories/mediaRepository.js', () => mediaRepository);
jest.unstable_mockModule('../../repositories/fileRepository.js', () => fileRepository);
jest.unstable_mockModule('../../utils/logger.js', () => ({ default: logger }));

const mediaService = await import('../../services/mediaService.js');

const MEDIA_ID = '01a0e2ac-9fc6-7163-b7b0-8f9c54fb4123';

const rejectionOf = async (promise) => {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('Expected the promise to reject');
};
const uploadedFile = (name, overrides = {}) => ({
  path: `/app/uploads/${name}`,
  originalname: name,
  mimetype: 'image/png',
  size: 1024,
  ...overrides,
});

describe('mediaService pagination', () => {
  test.each([
    [1, 10, 0],
    [2, 10, 10],
    [3, 25, 50],
    [10, 2, 18],
  ])('toOffset(page=%i, limit=%i) is %i', (page, limit, expected) => {
    expect(mediaService.toOffset(page, limit)).toBe(expected);
  });

  test.each([
    [0, 10, 0],
    [1, 10, 1],
    [20, 10, 2],
    [23, 10, 3],
    [84, 10, 9],
    [50, 50, 1],
  ])('total=%i with limit=%i gives totalPages=%i', (total, limit, totalPages) => {
    expect(mediaService.buildPagination({ total, page: 1, limit }).totalPages).toBe(totalPages);
  });

  test('buildPagination returns the full metadata shape', () => {
    expect(mediaService.buildPagination({ total: 84, page: 2, limit: 10 })).toEqual({
      total: 84,
      page: 2,
      limit: 10,
      totalPages: 9,
    });
  });

  test('listMedia queries the right slice and returns pagination metadata', async () => {
    const results = [{ id: 'a' }, { id: 'b' }];
    mediaRepository.findAndCount.mockResolvedValue({ results, total: 84 });

    const output = await mediaService.listMedia({
      page: 2,
      limit: 10,
      sortBy: 'title',
      order: 'asc',
      category: 'IMAGE',
      tags: ['beach'],
      search: 'sun',
    });

    expect(mediaRepository.findAndCount).toHaveBeenCalledWith({
      filters: { category: 'IMAGE', tags: ['beach'], search: 'sun' },
      sortBy: 'title',
      order: 'asc',
      offset: 10,
      limit: 10,
    });
    expect(output).toEqual({
      results,
      pagination: { total: 84, page: 2, limit: 10, totalPages: 9 },
    });
  });

  test('a page beyond the last one returns empty results with correct metadata', async () => {
    mediaRepository.findAndCount.mockResolvedValue({ results: [], total: 5 });

    const output = await mediaService.listMedia({
      page: 10,
      limit: 2,
      sortBy: 'createdAt',
      order: 'desc',
    });

    expect(output).toEqual({
      results: [],
      pagination: { total: 5, page: 10, limit: 2, totalPages: 3 },
    });
  });
});

describe('mediaService CRUD', () => {
  beforeEach(() => {
    mediaRepository.create.mockImplementation(async (data) => ({ id: MEDIA_ID, ...data }));
    mediaRepository.createMany.mockImplementation(async (records) =>
      records.map((r, i) => ({ id: `id-${i}`, ...r })),
    );
  });

  test('createMedia builds the record from the upload and logs it', async () => {
    const media = await mediaService.createMedia(
      uploadedFile('abc.png', { originalname: 'Beach.png' }),
      {
        title: 'Beach',
        tags: ['summer'],
        category: 'IMAGE',
      },
    );

    expect(mediaRepository.create).toHaveBeenCalledWith({
      title: 'Beach',
      tags: ['summer'],
      category: 'IMAGE',
      filePath: 'uploads/abc.png',
      originalName: 'Beach.png',
      mimeType: 'image/png',
      fileSize: 1024,
    });
    expect(media.id).toBe(MEDIA_ID);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: MEDIA_ID, originalName: 'Beach.png' }),
      'File uploaded',
    );
  });

  test('createMedia truncates very long original filenames to 255 characters', async () => {
    const longName = `${'a'.repeat(300)}.png`;
    await mediaService.createMedia(uploadedFile('x.png', { originalname: longName }), {
      title: 't',
      tags: [],
      category: 'IMAGE',
    });

    expect(mediaRepository.create.mock.calls[0][0].originalName).toHaveLength(255);
  });

  test('createMediaBatch derives each title from its filename and logs every file', async () => {
    const records = await mediaService.createMediaBatch(
      [
        uploadedFile('a.png', { originalname: 'mountain-view.jpg' }),
        uploadedFile('b.png', { originalname: '   .jpg' }),
      ],
      { tags: ['batch'], category: 'OTHER' },
    );

    expect(records.map((r) => r.title)).toEqual(['mountain-view', 'Untitled']);
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  test('getMediaById returns the record when it exists', async () => {
    mediaRepository.findById.mockResolvedValue({ id: MEDIA_ID });

    await expect(mediaService.getMediaById(MEDIA_ID)).resolves.toEqual({ id: MEDIA_ID });
  });

  test.each([
    ['getMediaById', () => mediaService.getMediaById(MEDIA_ID), 'findById'],
    ['updateMedia', () => mediaService.updateMedia(MEDIA_ID, { title: 'x' }), 'updateById'],
    ['deleteMedia', () => mediaService.deleteMedia(MEDIA_ID), 'deleteById'],
  ])('%s throws a 404 AppError when the record does not exist', async (_name, call, repoMethod) => {
    mediaRepository[repoMethod].mockResolvedValue(null);

    const error = await rejectionOf(call());

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Media not found');
  });

  test('deleteMedia removes the database record before the file', async () => {
    mediaRepository.deleteById.mockResolvedValue({ id: MEDIA_ID, filePath: 'uploads/a.png' });

    await mediaService.deleteMedia(MEDIA_ID);

    expect(fileRepository.removeFile).toHaveBeenCalledWith('uploads/a.png');
    expect(mediaRepository.deleteById.mock.invocationCallOrder[0]).toBeLessThan(
      fileRepository.removeFile.mock.invocationCallOrder[0],
    );
  });

  test('deleteMedia still succeeds when the file cannot be removed, and logs the failure', async () => {
    mediaRepository.deleteById.mockResolvedValue({ id: MEDIA_ID, filePath: 'uploads/a.png' });
    fileRepository.removeFile.mockRejectedValueOnce(new Error('EACCES'));

    await expect(mediaService.deleteMedia(MEDIA_ID)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: MEDIA_ID }),
      'Media deleted but its file could not be removed',
    );
  });
});
