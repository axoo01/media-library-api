import AppError from '../utils/AppError.js';

// Drops the request location from the path, e.g. ['body', 'title'] -> 'title'.
const toField = (path) =>
  path.length > 1 ? path.slice(1).join('.') : String(path[0] ?? 'request');

const formatIssues = (issues) =>
  issues.flatMap((issue) => {
    const field = toField(issue.path);

    if (issue.code === 'unrecognized_keys') {
      const prefix = issue.path.length > 1 ? `${field}.` : '';
      return issue.keys.map((key) => ({
        field: `${prefix}${key}`,
        message: `Unknown field '${key}'`,
      }));
    }

    return { field, message: issue.message };
  });

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    // Express 5 leaves req.body undefined when no body parser ran.
    body: req.body ?? {},
    query: req.query,
    params: req.params,
    file: req.file,
    files: req.files,
  });

  if (!result.success) {
    return next(AppError.badRequest('Validation failed', formatIssues(result.error.issues)));
  }

  // req.query is a read-only getter in Express 5, so parsed values live on req.validated.
  req.validated = result.data;
  return next();
};

export default validate;
