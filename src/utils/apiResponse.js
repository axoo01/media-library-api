export const sendSuccess = (res, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ status: 'success', data });

export const sendError = (res, { statusCode, message, details = [] }) =>
  res.status(statusCode).json({ status: 'error', message, details });
