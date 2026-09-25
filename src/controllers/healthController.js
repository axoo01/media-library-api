import { sendSuccess } from '../utils/apiResponse.js';

export const getHealth = (_req, res) =>
  sendSuccess(res, {
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
