import { defineConfig } from '@playwright/test';

/**
 * Two spec folders: `e2e/mocked` runs on route fixtures and needs no service; `e2e/gate` needs the api
 * with the engine and the database at the base URL. `E2E_BASE_URL` aims a run at a build served
 * elsewhere (the api hosts one on :5000); without it the dev server on :4200 is started or reused.
 */
const externalBaseUrl = process.env['E2E_BASE_URL'];

export default defineConfig({
  testDir: 'e2e',
  // preview.ts is the headed look at the app (`npm run preview`); it skips itself in any other run
  testMatch: ['mocked/**/*.spec.ts', 'gate/**/*.spec.ts', 'preview.ts'],
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: true,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: externalBaseUrl ?? 'http://localhost:4200',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        // without prebundling: the dev server would otherwise reload the page mid-test the first time a
        // lazy screen brings a dependency it has not bundled yet
        command: 'npx ng serve --port 4200 --prebundle=false',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
