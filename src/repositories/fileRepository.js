import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT, UPLOAD_DIR } from '../config/storage.js';

// Defence in depth against path traversal: only files directly inside UPLOAD_DIR are ever touched.
const resolveUploadPath = (filePath) => {
  const absolutePath = path.resolve(PROJECT_ROOT, filePath);
  if (path.dirname(absolutePath) !== UPLOAD_DIR) {
    throw new Error(`Refusing to access a file outside the upload directory: ${filePath}`);
  }
  return absolutePath;
};

export const ensureUploadDir = () => fs.mkdir(UPLOAD_DIR, { recursive: true });

// Stored relative to the project root with forward slashes, so records stay valid if the project moves.
export const toStoredPath = (absolutePath) =>
  path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');

export const readFileHeader = async (filePath, length) => {
  const handle = await fs.open(resolveUploadPath(filePath), 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(length), 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

export const removeFile = async (filePath) => {
  try {
    await fs.unlink(resolveUploadPath(filePath));
  } catch (err) {
    // Already gone is the desired end state, not a failure.
    if (err.code !== 'ENOENT') throw err;
  }
};
