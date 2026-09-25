import dotenvFlow from 'dotenv-flow';
import { z } from 'zod';
import { PROJECT_ROOT } from './paths.js';

export class EnvValidationError extends Error {
  constructor(problems) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

const REQUIRED_VARIABLES = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'MAX_FILE_SIZE_MB',
  'UPLOAD_DIR',
  'LOG_LEVEL',
];

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65535),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: 'Must be a PostgreSQL connection URL',
    }),
    JWT_SECRET: z.string().min(32, 'Must be at least 32 characters'),
    MAX_FILE_SIZE_MB: z.coerce.number().positive().max(100),
    UPLOAD_DIR: z.string().trim().min(1),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  })
  .superRefine((env, ctx) => {
    // Tests truncate tables, so they must never run against a non-test database.
    if (env.NODE_ENV === 'test' && !new URL(env.DATABASE_URL).pathname.endsWith('_test')) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'In test, must point to a database whose name ends with "_test"',
      });
    }
  });

export const parseEnv = (source) => {
  const missing = REQUIRED_VARIABLES.filter((key) => !source[key]?.trim());
  if (missing.length > 0) {
    throw new EnvValidationError(missing.map((key) => `${key} is required but not set`));
  }

  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  return Object.freeze({
    ...result.data,
    isProduction: result.data.NODE_ENV === 'production',
    isTest: result.data.NODE_ENV === 'test',
  });
};

// Loads .env.<NODE_ENV>; variables already set in the process (CI, Vercel) always win.
dotenvFlow.config({ path: PROJECT_ROOT, default_node_env: 'development', silent: true });

let env;
try {
  env = parseEnv(process.env);
} catch (err) {
  if (!(err instanceof EnvValidationError)) throw err;
  // The logger depends on env, so write to stderr directly.
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}

export default env;
