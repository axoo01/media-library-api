import path from 'node:path';
import env from './env.js';
import { PROJECT_ROOT } from './paths.js';

export { PROJECT_ROOT };
export const UPLOAD_DIR = path.resolve(PROJECT_ROOT, env.UPLOAD_DIR);
export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;
