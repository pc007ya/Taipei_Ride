// Optional, read-only visual reference capture. Third-party failures never
// determine whether our own game passes. Original code/assets are not copied.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const dir = 'test-results/reference';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 960 }], ['portrait', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'portrait', hasTouch: name === 'portrait' });
    // Do not log in, submit forms, solve challenges, or send non-read requests.
    await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    const result = { viewport: name, url: 'https://taipei-gta.vercel.app/', observedAt: new Date().toISOString(), errors: [] };
    page.on('pageerror', error => result.errors.push(error.message));
    try {
      await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(10_000);
      const text = await page.locator('body').innerText();
      result.title = await page.title();
      result.buttons = await page.getByRole('button').allTextContents();
      result.challenge = /verify you are human|checking your browser|captcha|驗證您是人類|驗證你是人類|安全驗證/i.test(text);
      await page.screenshot({ path: `${dir}/${name}-entry.png`, fullPage: true });
      if (result.challenge) {
        result.status = 'blocked-by-challenge-no-interaction';
      } else {
        const start = page.getByRole('button', { name: /^(開始遊戲|開始冒險|進入遊戲|開始|Start Game|Play)$/i });
        if (await start.count() === 1 && await start.isVisible()) {
          await start.click();
          await page.waitForTimeout(8_000);
          await page.screenshot({ path: `${dir}/${name}-after-start.png`, fullPage: true });
          result.status = 'captured-entry-and-start';
        } else result.status = 'captured-visible-entry';
      }
      result.canvasCount = await page.locator('canvas').count();
    } catch (error) { result.status = 'reference-unavailable'; result.error = error.message; }
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${dir}/capture-report.json`, JSON.stringify(results, null, 2));
}
