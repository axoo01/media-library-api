import { ALLOWED_FILE_TYPES } from '../../models/Media.js';
import { MAX_FILE_SIZE_BYTES } from '../../config/storage.js';

// Real magic bytes padded to a size, so uploads pass the signature check like genuine files.
const withSignature = (mimeType, size = 256) => {
  const buffer = Buffer.alloc(size);
  Buffer.from(ALLOWED_FILE_TYPES[mimeType].signature).copy(buffer);
  return buffer;
};

export const png = (size) => withSignature('image/png', size);
export const jpg = (size) => withSignature('image/jpeg', size);
export const pdf = (size) => withSignature('application/pdf', size);
export const text = () => Buffer.from('just some plain text');
export const oversizedPng = () => png(MAX_FILE_SIZE_BYTES + 1024);
