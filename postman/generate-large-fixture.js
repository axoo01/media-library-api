import fs from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_FILE_TYPES } from '../src/models/Media.js';
import { MAX_FILE_SIZE_BYTES } from '../src/config/storage.js';

// Generated instead of committed: a valid PNG signature padded to 1MB over the upload limit.
const target = path.join(import.meta.dirname, 'fixtures', 'large.png');
const content = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024 * 1024);
Buffer.from(ALLOWED_FILE_TYPES['image/png'].signature).copy(content);

await fs.writeFile(target, content);
