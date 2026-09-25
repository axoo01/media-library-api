import path from 'node:path';

// Resolved from this file, not process.cwd(), so paths work wherever node is started from.
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
