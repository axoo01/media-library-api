import env from '../config/env.js';
import logger from './logger.js';

const cleanupTasks = [];
let isShuttingDown = false;

export const onShutdown = (task) => {
  cleanupTasks.push(task);
};

export const shutdown = async (reason, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Graceful shutdown started (${reason})`);

  const forceExitTimer = setTimeout(() => {
    logger.error(`Shutdown timed out after ${env.SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  // unref() so this timer alone never keeps the process alive once cleanup finishes.
  forceExitTimer.unref();

  let code = exitCode;
  try {
    // LIFO: the HTTP server closes before the resources it depends on (e.g. the DB).
    for (const task of [...cleanupTasks].reverse()) {
      await task();
    }
    logger.info('Graceful shutdown complete');
  } catch (err) {
    logger.error('Error during graceful shutdown', err);
    code = 1;
  }

  process.exit(code);
};

// Process state is unreliable after a synchronous throw, so exit without async cleanup.
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION, shutting down immediately', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION, shutting down gracefully', reason);
  shutdown('unhandledRejection', 1);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (isShuttingDown) {
      logger.warn(`${signal} received again, forcing exit`);
      process.exit(1);
    }
    shutdown(signal, 0);
  });
}
