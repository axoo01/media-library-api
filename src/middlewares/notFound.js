import AppError from '../utils/AppError.js';

const notFound = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export default notFound;
