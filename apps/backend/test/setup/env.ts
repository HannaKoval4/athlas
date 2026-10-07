import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';

/**
 * Points DATABASE_URL at the disposable test database (DATABASE_URL_TEST)
 * so that e2e tests can never touch the development data.
 */
export function useTestDatabase(): string {
  loadEnv({
    path: [join(__dirname, '..', '..', '.env'), join(__dirname, '..', '..', '..', '..', '.env')],
    quiet: true,
  });

  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST is not set. Copy .env.example to .env in the repo root.');
  }
  assertTestDatabaseUrl(testUrl);
  process.env.DATABASE_URL = testUrl;
  return testUrl;
}

/** Guard against destructive test helpers running on a non-test database. */
export function assertTestDatabaseUrl(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to use database "${dbName}" for tests: name must end with "_test".`);
  }
}
