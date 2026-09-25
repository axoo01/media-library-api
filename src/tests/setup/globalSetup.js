import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export default async () => {
  // Importing env runs startup validation, including the "database name must end with _test" guard.
  const { default: env } = await import('../../config/env.js');
  const { PROJECT_ROOT, UPLOAD_DIR } = await import('../../config/storage.js');
  if (!env.isTest) throw new Error(`Tests must run with NODE_ENV=test (got ${env.NODE_ENV})`);

  execFileSync(path.join(PROJECT_ROOT, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: 'pipe',
  });

  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};
