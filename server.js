// Must stay the first import so process handlers are registered before other modules evaluate.
import { onShutdown } from './src/utils/processHandlers.js';

import { once } from 'node:events';
import { promisify } from 'node:util';
import app from './src/app.js';
import env from './src/config/env.js';
import { connectDatabase, disconnectDatabase } from './src/config/db.js';
import { ensureUploadDir } from './src/repositories/fileRepository.js';
import logger from './src/utils/logger.js';

try {
  await connectDatabase();
} catch (err) {
  logger.error({ err }, 'Failed to connect to the database');
  process.exit(1);
}
onShutdown(disconnectDatabase);

try {
  await ensureUploadDir();
} catch (err) {
  logger.error({ err }, 'Failed to prepare the upload directory');
  process.exit(1);
}

const server = app.listen(env.PORT);

try {
  // Resolves on 'listening', rejects on 'error' (e.g. EADDRINUSE when the port is taken).
  await once(server, 'listening');
  logger.info({ port: env.PORT, env: env.NODE_ENV }, `Server started on port ${env.PORT}`);
} catch (err) {
  logger.error({ err, port: env.PORT }, 'Failed to start server');
  process.exit(1);
}

const closeServer = promisify(server.close.bind(server));
onShutdown(async () => {
  await closeServer();
  logger.info('HTTP server closed');
});
