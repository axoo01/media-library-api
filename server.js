// Must stay the first import so process handlers are registered before other modules evaluate.
import { onShutdown } from './src/utils/processHandlers.js';

import { once } from 'node:events';
import { promisify } from 'node:util';
import app from './src/app.js';
import env from './src/config/env.js';
import { connectDatabase, disconnectDatabase } from './src/config/db.js';
import logger from './src/utils/logger.js';

try {
  await connectDatabase();
} catch (err) {
  logger.error('Failed to connect to the database', err);
  process.exit(1);
}
onShutdown(disconnectDatabase);

const server = app.listen(env.PORT);

try {
  await once(server, 'listening');
  logger.info(`Media Library API listening on port ${env.PORT} (${env.NODE_ENV})`);
} catch (err) {
  logger.error(`Failed to start server on port ${env.PORT}`, err);
  process.exit(1);
}

const closeServer = promisify(server.close.bind(server));
onShutdown(async () => {
  await closeServer();
  logger.info('HTTP server closed');
});
