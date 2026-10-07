/* Seed entry point: `pnpm db:seed` (prisma.config.ts -> migrations.seed). */
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../../src/generated/prisma/client';
import { loadSeedData } from './load';
import { seedDatabase } from './seed';
import { collectVerifyNotes, validateSeedData } from './validate';

loadEnv({
  path: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
  quiet: true,
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

async function main(): Promise<void> {
  const data = loadSeedData();

  const issues = validateSeedData(data);
  if (issues.length > 0) {
    console.error(`Seed data is invalid (${issues.length} problems):`);
    issues.forEach((issue) => console.error(`  - ${issue}`));
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });
  try {
    const counts = await seedDatabase(prisma, data, {
      admin: {
        email: requireEnv('SEED_ADMIN_EMAIL'),
        password: requireEnv('SEED_ADMIN_PASSWORD'),
        name: 'Administrator',
      },
      demo: {
        email: process.env.SEED_DEMO_EMAIL ?? 'demo@atlas.local',
        password: process.env.SEED_DEMO_PASSWORD ?? 'Demo12345',
        name: 'Demo',
      },
    });
    console.log('Seed completed. Rows in database:');
    console.table(counts);

    const notes = collectVerifyNotes(data);
    console.log(`\nVERIFY: ${notes.length} places need a manual fact check:`);
    notes.forEach((note) => console.log(`  - ${note}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
