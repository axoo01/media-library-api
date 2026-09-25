import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '../../config/db.js';
import { UPLOAD_DIR } from '../../config/storage.js';

export { prisma };

export const resetDatabase = () => prisma.$executeRawUnsafe('TRUNCATE TABLE "media"');

export const clearUploads = async () => {
  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

export const uploadedFiles = async () => (await fs.readdir(UPLOAD_DIR)).sort();

export const fileExists = async (storedPath) => {
  try {
    await fs.access(path.join(UPLOAD_DIR, path.basename(storedPath)));
    return true;
  } catch {
    return false;
  }
};

// Inserts rows directly (no files on disk) for tests that only exercise querying.
export const insertMedia = (records) =>
  prisma.media.createManyAndReturn({
    data: records.map((record, i) => ({
      filePath: `uploads/test-${i}-${record.title.replace(/\W+/g, '-')}.png`,
      originalName: `${record.title}.png`,
      mimeType: 'image/png',
      fileSize: 1024,
      tags: [],
      ...record,
    })),
  });
