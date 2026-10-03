import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173/rentorown/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort --base=/rentorown/',
    url: 'http://127.0.0.1:4173/rentorown/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
