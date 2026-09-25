import prisma from '../config/db.js';
import { Prisma } from '../generated/prisma/client.ts';

// Prisma signals a missing row on update/delete with P2025; callers get null instead.
const nullIfNotFound = async (query) => {
  try {
    return await query;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return null;
    throw err;
  }
};

// Translates domain filters into Prisma query syntax so services stay ORM-agnostic.
const buildWhere = ({ category, tags, search } = {}) => ({
  ...(category && { category }),
  ...(tags?.length && { tags: { hasSome: tags } }),
  ...(search && { title: { contains: search, mode: 'insensitive' } }),
});

export const create = (data) => prisma.media.create({ data });

// Single INSERT statement, so a bulk upload is saved atomically.
export const createMany = (records) => prisma.media.createManyAndReturn({ data: records });

export const findById = (id) => prisma.media.findUnique({ where: { id } });

export const findAndCount = async ({ filters, sortBy, order, offset, limit }) => {
  const where = buildWhere(filters);

  const [results, total] = await Promise.all([
    prisma.media.findMany({
      where,
      // id as tie-breaker keeps page boundaries stable when sort values are equal.
      orderBy: [{ [sortBy]: order }, { id: order }],
      skip: offset,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  return { results, total };
};

export const updateById = (id, data) =>
  nullIfNotFound(prisma.media.update({ where: { id }, data }));

// Returns the deleted row, so the caller gets its filePath without a separate lookup.
export const deleteById = (id) => nullIfNotFound(prisma.media.delete({ where: { id } }));
