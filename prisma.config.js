import dotenvFlow from 'dotenv-flow';
import { defineConfig } from 'prisma/config';

// Same loading rules as the app, so NODE_ENV=test migrates the test database.
dotenvFlow.config({ path: import.meta.dirname, default_node_env: 'development', silent: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  // process.env instead of env(): `prisma generate` must work on a fresh clone without env files.
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
