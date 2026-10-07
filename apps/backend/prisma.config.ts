import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 does not read .env by itself. The single .env lives in the repo root;
// variables already set in the environment (e.g. DATABASE_URL for tests) win.
loadEnv({
  path: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
  quiet: true,
});

export default defineConfig({
  schema: join('prisma', 'schema.prisma'),
  migrations: {
    path: join('prisma', 'migrations'),
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
