import { MediaCategory } from '../generated/prisma/enums.ts';

// The Prisma schema is the single source of truth for categories.
export { MediaCategory };
export const MEDIA_CATEGORIES = Object.values(MediaCategory);

export const ALLOWED_MIME_TYPES = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
});

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_BULK_FILES = 5;

export const SORTABLE_FIELDS = Object.freeze(['createdAt', 'updatedAt', 'title', 'fileSize']);
export const SORT_ORDERS = Object.freeze(['asc', 'desc']);

export const PAGINATION = Object.freeze({ DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 50 });
