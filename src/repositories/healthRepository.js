import prisma from '../config/db.js';

export const pingDatabase = () => prisma.$queryRaw`SELECT 1`;
