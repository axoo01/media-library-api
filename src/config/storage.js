import path from 'node:path';
import env from './env.js';

// Resolved from this file, not process.cwd(), so paths work wherever node is started from.
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
export const UPLOAD_DIR = path.resolve(PROJECT_ROOT, env.UPLOAD_DIR);
