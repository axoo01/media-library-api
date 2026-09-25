import path from 'node:path';
import env from './env.js';

// Resolved from this file rather than process.cwd(), so paths don't depend on where node is started.
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
export const UPLOAD_DIR = path.resolve(PROJECT_ROOT, env.UPLOAD_DIR);
