import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Run tests serially - Electron desktop app with shared SQLite database
  // cannot handle multiple instances
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Single worker to prevent multiple Electron instances from conflicting
  workers: 1,
  reporter: 'html',
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  timeout: 60000, // 60 seconds per test
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
