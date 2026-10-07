import { useTestDatabase } from './env';

// Runs in every e2e test worker before the test file is loaded.
useTestDatabase();

// Many e2e tests log in from the same IP (overrides .env); throttling has its own test file.
process.env.THROTTLE_AUTH_LIMIT = '1000';
