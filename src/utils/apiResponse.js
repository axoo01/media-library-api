export const sendSuccess = (res, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ status: 'success', data });

export const sendError = (res, { statusCode, status = 'error', message, details = [] }) =>
  res.status(statusCode).json({ status, message, details });
