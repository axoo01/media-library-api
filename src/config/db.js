import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import env from './env.js';
import logger from '../utils/logger.js';

// ES modules are cached after first import, so this instance is a process-wide singleton.
// Query errors are not logged here; they reach the global error handler, which logs them once.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: ['warn'],
});

export const connectDatabase = async () => {
  // The pg pool connects lazily; a real query makes an unreachable database fail at boot.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    throw new Error(`Database connection failed (${err.code ?? err.message})`, { cause: err });
  }
  logger.info('Database connected');
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
};

export default prisma;
