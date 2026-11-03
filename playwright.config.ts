import { defineConfig, devices } from '@playwright/test';

// Test accounts live in .env.test (not committed). Skipped if the file is absent, e.g. in CI with real env vars.
try {
  process.loadEnvFile('.env.test');
} catch {}
// Locally the server keys (used by the skip checks in the tests) are in .env.local. Not in CI.
try {
  process.loadEnvFile('.env.local');
} catch {}

const supabaseEnv: Record<string, string> = {};
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  const value = process.env[name];
  if (value) supabaseEnv[name] = value;
}

export default defineConfig({
  testDir: './tests',
  // The 200-visitor traffic run has its own config (playwright.traffic.config.ts).
  testIgnore: 'traffic.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line'], ['html', { open: process.env.CI ? 'never' : 'on-failure' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on',
  },
  // Chromium only (CI installs only this browser).
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: supabaseEnv,
  },
});
