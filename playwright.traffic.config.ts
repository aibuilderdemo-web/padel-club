import { defineConfig, devices } from '@playwright/test';

// Config for tests/traffic.spec.ts only: no local web server, it runs against PREVIEW_URL.
try {
  process.loadEnvFile('.env.test');
} catch {}
try {
  process.loadEnvFile('.env.local');
} catch {}

export default defineConfig({
  testDir: './tests',
  testMatch: 'traffic.spec.ts',
  workers: 1,
  retries: 0,
  reporter: [['line']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
