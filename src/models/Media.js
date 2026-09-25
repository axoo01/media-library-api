import { MediaCategory } from '../generated/prisma/enums.ts';

// The Prisma schema is the single source of truth for categories.
export { MediaCategory };
export const MEDIA_CATEGORIES = Object.values(MediaCategory);

// Signatures are each format's magic bytes; the client-declared MIME type alone can be spoofed.
export const ALLOWED_FILE_TYPES = Object.freeze({
  'image/jpeg': { extension: '.jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: '.png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'application/pdf': { extension: '.pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
});
export const ALLOWED_MIME_TYPES = Object.freeze(Object.keys(ALLOWED_FILE_TYPES));

export const MAX_BULK_FILES = 5;

export const SORTABLE_FIELDS = Object.freeze(['createdAt', 'updatedAt', 'title', 'fileSize']);
export const SORT_ORDERS = Object.freeze(['asc', 'desc']);

export const PAGINATION = Object.freeze({ DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 50 });
