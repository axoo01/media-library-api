import * as healthService from '../services/healthService.js';

// Deliberately outside the success/error envelope: uptime monitors expect this exact shape.
export const getHealth = async (_req, res) => {
  const health = await healthService.checkHealth();
  res
    .status(health.status === 'ok' ? 200 : 503)
    .set('Cache-Control', 'no-store')
    .json(health);
};
