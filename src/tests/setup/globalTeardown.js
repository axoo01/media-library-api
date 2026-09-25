import fs from 'node:fs/promises';

export default async () => {
  const { UPLOAD_DIR } = await import('../../config/storage.js');
  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
};
