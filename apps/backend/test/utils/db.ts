import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { assertTestDatabaseUrl } from '../setup/env';

export function createTestPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (test-env setup did not run?)');
  assertTestDatabaseUrl(url);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Empties every application table (keeps the migrations table). Test database only. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  assertTestDatabaseUrl(url);

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
