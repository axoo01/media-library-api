// Express 5 forwards rejections natively; kept explicit for readability and Express 4 portability.
const catchAsync = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (err) {
    next(err);
  }
};

export default catchAsync;
