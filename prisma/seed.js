import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../src/config/env.js';
import prisma from '../src/config/db.js';
import { UPLOAD_DIR } from '../src/config/storage.js';
import * as fileRepository from '../src/repositories/fileRepository.js';
import { ALLOWED_FILE_TYPES } from '../src/models/Media.js';
import logger from '../src/utils/logger.js';

const SEED_PREFIX = fileRepository.toStoredPath(path.join(UPLOAD_DIR, 'seed-'));

// Mixed-case titles, a shared fileSize and a shared createdAt exercise sorting and tie-breakers.
const SEED_MEDIA = [
  {
    title: 'Summer beach sunset',
    category: 'IMAGE',
    tags: ['beach', 'summer', 'travel'],
    mimeType: 'image/jpeg',
    fileSize: 20480,
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    title: 'annual report 2025',
    category: 'DOCUMENT',
    tags: ['finance', 'report'],
    mimeType: 'application/pdf',
    fileSize: 10240,
    createdAt: '2026-09-02T09:00:00Z',
  },
  {
    title: 'Brand guidelines',
    category: 'DOCUMENT',
    tags: ['branding', 'design'],
    mimeType: 'application/pdf',
    fileSize: 10240,
    createdAt: '2026-09-03T09:00:00Z',
  },
  {
    title: 'podcast cover art',
    category: 'AUDIO',
    tags: ['podcast', 'marketing'],
    mimeType: 'image/png',
    fileSize: 5120,
    createdAt: '2026-09-03T09:00:00Z',
  },
  {
    title: 'City skyline night',
    category: 'IMAGE',
    tags: ['city', 'night', 'travel'],
    mimeType: 'image/jpeg',
    fileSize: 30720,
    createdAt: '2026-09-04T09:00:00Z',
  },
];

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Real files with valid signatures keep the database and the upload directory consistent.
const writeSeedFile = async ({ filePath, mimeType, fileSize }) => {
  const content = Buffer.alloc(fileSize);
  Buffer.from(ALLOWED_FILE_TYPES[mimeType].signature).copy(content);
  await fs.writeFile(path.join(UPLOAD_DIR, path.basename(filePath)), content);
};

// Only records created by this script are replaced, so re-running never touches real uploads.
const removePreviousSeed = async () => {
  const where = { filePath: { startsWith: SEED_PREFIX } };
  const previous = await prisma.media.findMany({ where, select: { filePath: true } });
  await Promise.all(previous.map((m) => fileRepository.removeFile(m.filePath)));
  const { count } = await prisma.media.deleteMany({ where });
  return count;
};

const seed = async () => {
  await fileRepository.ensureUploadDir();
  const removed = await removePreviousSeed();

  const records = SEED_MEDIA.map((media, index) => {
    const extension = ALLOWED_FILE_TYPES[media.mimeType].extension;
    const createdAt = new Date(media.createdAt);
    return {
      ...media,
      filePath: `${SEED_PREFIX}${index + 1}${extension}`,
      originalName: `${slugify(media.title)}${extension}`,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await Promise.all(records.map(writeSeedFile));
  await prisma.media.createMany({ data: records });

  logger.info(
    `Seed complete: removed ${removed} previous seed records, inserted ${records.length}`,
  );
};

if (env.isProduction) {
  logger.error('Refusing to seed a production database');
  process.exit(1);
}

try {
  await seed();
} catch (err) {
  logger.error('Seeding failed', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
