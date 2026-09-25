import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import logger from '../utils/logger.js';
import requestContext from '../utils/requestContext.js';

// Upstream ids are reused for tracing, but only if they're short and safe to write into logs.
const SAFE_REQUEST_ID = /^[\w-]{1,100}$/;

// Mounted routers rewrite req.url, so originalUrl is the path the client actually requested.
const pathOf = (req) => req.originalUrl ?? req.url;

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = SAFE_REQUEST_ID.test(incoming ?? '') ? incoming : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customReceivedMessage: (req) => `Incoming request ${req.method} ${pathOf(req)}`,
  customSuccessMessage: (req, res, responseTime) =>
    `${req.method} ${pathOf(req)} ${res.statusCode} ${Math.round(responseTime)}ms`,
  // Errors are logged once, with full detail, by the global error handler.
  customLogLevel: () => 'info',
  // Uptime monitors hit /health every minute; logging those would drown out real traffic.
  autoLogging: { ignore: (req) => pathOf(req) === '/health' },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: pathOf(req) }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

const bindRequestContext = (req, _res, next) => requestContext.run({ reqId: req.id }, next);

export default [httpLogger, bindRequestContext];
