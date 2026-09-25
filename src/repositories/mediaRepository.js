import prisma from '../config/db.js';

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

export const updateById = (id, data) => prisma.media.update({ where: { id }, data });

export const deleteById = (id) => prisma.media.delete({ where: { id } });
