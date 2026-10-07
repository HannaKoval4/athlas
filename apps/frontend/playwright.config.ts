import { defineConfig, devices } from '@playwright/test';

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Starts both apps unless they are already running (e.g. via `pnpm dev`).
  webServer: [
    {
      command: 'pnpm --filter @atlas/backend start',
      url: 'http://localhost:3000/api/health',
      // UI tests register several users per run from one IP; keep throttling but raise the limit.
      env: { THROTTLE_AUTH_LIMIT: '100' },
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @atlas/frontend dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCi,
      timeout: 60_000,
    },
  ],
});
