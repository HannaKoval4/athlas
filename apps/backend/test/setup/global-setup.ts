import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { useTestDatabase } from './env';

/**
 * Brings the test database schema up to date once per e2e run.
 * `migrate deploy` is non-destructive: it only applies pending migrations.
 */
export default function globalSetup(): void {
  useTestDatabase();
  execSync('prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'inherit',
  });
}
