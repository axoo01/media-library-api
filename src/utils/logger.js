import env from '../config/env.js';

// Human-readable in development, one JSON object per line in production.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = env.isProduction ? LEVELS.info : LEVELS.debug;

const serializeError = (err) =>
  err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err;

const write = (level, message, meta) => {
  if (LEVELS[level] > activeLevel) return;

  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  const timestamp = new Date().toISOString();

  if (env.isProduction) {
    stream(
      JSON.stringify({ timestamp, level, message, ...(meta && { meta: serializeError(meta) }) }),
    );
    return;
  }

  const line = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}`;
  if (meta instanceof Error) stream(line, '\n', meta.stack);
  else if (meta !== undefined) stream(line, meta);
  else stream(line);
};

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

export default logger;
