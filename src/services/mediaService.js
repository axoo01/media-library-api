import path from 'node:path';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import * as mediaRepository from '../repositories/mediaRepository.js';
import * as fileRepository from '../repositories/fileRepository.js';

const MAX_NAME_LENGTH = 255;

const notFound = () => AppError.notFound('Media not found');

const toMediaRecord = (file, { title, tags, category }) => ({
  title,
  tags,
  category,
  filePath: fileRepository.toStoredPath(file.path),
  originalName: file.originalname.slice(0, MAX_NAME_LENGTH),
  mimeType: file.mimetype,
  fileSize: file.size,
});

const titleFromFilename = (filename) =>
  path.parse(filename).name.trim().slice(0, MAX_NAME_LENGTH) || 'Untitled';

const logUpload = ({ id, originalName, mimeType, fileSize, filePath }) =>
  logger.info({ mediaId: id, originalName, mimeType, fileSize, filePath }, 'File uploaded');

export const createMedia = async (file, metadata) => {
  const media = await mediaRepository.create(toMediaRecord(file, metadata));
  logUpload(media);
  return media;
};

// Bulk uploads share tags and category; each title is derived from its original filename.
export const createMediaBatch = async (files, metadata) => {
  const records = await mediaRepository.createMany(
    files.map((file) =>
      toMediaRecord(file, { ...metadata, title: titleFromFilename(file.originalname) }),
    ),
  );
  records.forEach(logUpload);
  return records;
};

export const getMediaById = async (id) => {
  const media = await mediaRepository.findById(id);
  if (!media) throw notFound();
  return media;
};

export const listMedia = async ({ page, limit, sortBy, order, category, tags, search }) => {
  const { results, total } = await mediaRepository.findAndCount({
    filters: { category, tags, search },
    sortBy,
    order,
    offset: (page - 1) * limit,
    limit,
  });

  return {
    results,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const updateMedia = async (id, changes) => {
  const media = await mediaRepository.updateById(id, changes);
  if (!media) throw notFound();
  return media;
};

// Record first, then file: an orphaned file is harmless, a record without its file is not.
export const deleteMedia = async (id) => {
  const media = await mediaRepository.deleteById(id);
  if (!media) throw notFound();

  try {
    await fileRepository.removeFile(media.filePath);
  } catch (err) {
    logger.error(
      { err, mediaId: id, filePath: media.filePath },
      'Media deleted but its file could not be removed',
    );
  }
};
