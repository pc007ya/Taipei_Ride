import { defineConfig } from '@playwright/test';

// SwiftShader runs the actual Chromium WebGL 2 implementation in an isolated
// runner. It is not a mocked canvas and never selects the 2D fallback.
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    trace: 'on',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 960 } } },
    { name: 'portrait', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
    { name: 'landscape', use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4175',
    env: { PORT: '4175' },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
