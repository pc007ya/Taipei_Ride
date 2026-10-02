import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

// An isolated visual-review branch compares the exact published baseline with
// the opt-in local sample. Neither server is deployed or reachable publicly.
export default defineConfig({
  ...base,
  testMatch: '**/sample.spec.mjs',
  timeout: 300_000,
  outputDir: 'sample-results',
  reporter: [['list'], ['html', { outputFolder: 'sample-report', open: 'never' }]],
  use: { ...base.use, deviceScaleFactor: 1 },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 } }],
  webServer: [
    { ...base.webServer },
    {
      command: 'node scripts/serve.mjs .quality-baseline/dist',
      url: 'http://127.0.0.1:4176',
      env: { PORT: '4176' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
