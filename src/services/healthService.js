import { setTimeout as delay } from 'node:timers/promises';
import logger from '../utils/logger.js';
import * as healthRepository from '../repositories/healthRepository.js';

const DB_TIMEOUT_MS = 2000;

// ref: false so a pending timer never keeps the process alive.
const timeout = async (ms) => {
  await delay(ms, undefined, { ref: false });
  throw new Error(`Database did not respond within ${ms}ms`);
};

const snapshot = (status) => ({
  status,
  uptime: Number(process.uptime().toFixed(2)),
  timestamp: new Date().toISOString(),
});

// A hung database must fail the check quickly, not hang the monitor's request.
export const checkHealth = async () => {
  try {
    await Promise.race([healthRepository.pingDatabase(), timeout(DB_TIMEOUT_MS)]);
    return snapshot('ok');
  } catch (err) {
    logger.error({ err }, 'Health check failed: database unreachable');
    return { ...snapshot('error'), message: 'Database unreachable' };
  }
};
