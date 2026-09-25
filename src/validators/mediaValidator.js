import { z } from 'zod';
import {
  MEDIA_CATEGORIES,
  MAX_BULK_FILES,
  PAGINATION,
  SORTABLE_FIELDS,
  SORT_ORDERS,
} from '../models/Media.js';

const MAX_TAGS = 20;

const isMissing = (issue) => issue.input === undefined;

const normalizeCase = (transform) => (value) =>
  typeof value === 'string' ? transform(value.trim()) : value;

const emptyToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// Multipart and query strings send tags as "a,b" or as repeated fields, so accept both shapes.
const splitTags = (value) => {
  if (value === undefined) return undefined;
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) =>
    typeof v === 'string' ? v.split(',') : [v],
  );
  return parts.filter((tag) => typeof tag !== 'string' || tag.trim() !== '');
};

const tagsSchema = z.preprocess(
  splitTags,
  z
    .array(
      z
        .string({ error: 'Each tag must be a string' })
        .trim()
        .toLowerCase()
        .max(30, 'Each tag must be at most 30 characters'),
      { error: 'Tags must be a comma-separated string or an array of strings' },
    )
    .max(MAX_TAGS, `A maximum of ${MAX_TAGS} tags is allowed`)
    .transform((tags) => [...new Set(tags)]),
);

const categorySchema = z.preprocess(
  normalizeCase((v) => v.toUpperCase()),
  z.enum(MEDIA_CATEGORIES, {
    error: (issue) =>
      isMissing(issue)
        ? 'Category is required'
        : `Category must be one of: ${MEDIA_CATEGORIES.join(', ')}`,
  }),
);

const titleSchema = z
  .string({ error: (issue) => (isMissing(issue) ? 'Title is required' : 'Title must be a string') })
  .trim()
  .min(1, 'Title is required')
  .max(255, 'Title must be at most 255 characters');

const idParamsSchema = z.object({
  id: z.uuid({ error: 'Media id must be a valid UUID' }),
});

export const createMediaSchema = z.object({
  body: z.strictObject({
    title: titleSchema,
    tags: tagsSchema.default([]),
    category: categorySchema,
  }),
  file: z.looseObject({ path: z.string() }, { error: 'File is required' }),
});

export const bulkCreateMediaSchema = z.object({
  body: z.strictObject({
    tags: tagsSchema.default([]),
    category: categorySchema,
  }),
  files: z
    .array(z.looseObject({ path: z.string() }), { error: 'At least one file is required' })
    .min(1, 'At least one file is required')
    .max(MAX_BULK_FILES, `A maximum of ${MAX_BULK_FILES} files is allowed`),
});

export const updateMediaSchema = z.object({
  params: idParamsSchema,
  body: z
    .strictObject({
      title: titleSchema.optional(),
      tags: tagsSchema.optional(),
      category: categorySchema.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      error: 'At least one of title, tags or category must be provided',
    }),
});

export const mediaIdSchema = z.object({
  params: idParamsSchema,
});

export const listMediaSchema = z.object({
  query: z.strictObject({
    page: z.coerce
      .number({ error: 'Page must be a number' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce
      .number({ error: 'Limit must be a number' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(PAGINATION.MAX_LIMIT, `Limit cannot exceed ${PAGINATION.MAX_LIMIT}`)
      .default(PAGINATION.DEFAULT_LIMIT),
    category: z.preprocess(emptyToUndefined, categorySchema.optional()),
    tags: z.preprocess(emptyToUndefined, tagsSchema.optional()),
    search: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'Search must be a string' })
        .trim()
        .max(100, 'Search must be at most 100 characters')
        .optional(),
    ),
    sortBy: z
      .enum(SORTABLE_FIELDS, { error: `sortBy must be one of: ${SORTABLE_FIELDS.join(', ')}` })
      .default('createdAt'),
    order: z.preprocess(
      normalizeCase((v) => v.toLowerCase()),
      z.enum(SORT_ORDERS, { error: 'order must be asc or desc' }).default('desc'),
    ),
  }),
});
