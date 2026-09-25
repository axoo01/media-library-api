import pino from 'pino';
import env from '../config/env.js';
import requestContext from './requestContext.js';

const isDevelopment = env.NODE_ENV === 'development';

const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'media-library-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Level names ("info") instead of numbers (30) are easier to filter in log aggregators.
  formatters: { level: (label) => ({ level: label }) },
  // Tags every line logged during a request with its id, including service and repository logs.
  mixin: () => {
    const reqId = requestContext.getStore()?.reqId;
    return reqId ? { reqId } : {};
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,service,env,req,res,responseTime',
      },
    },
  }),
});

export default logger;
