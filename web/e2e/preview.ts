import { test } from './support/mocked';

/**
 * A look at the app with no backend: a headed Chromium over the same in-memory api the mocked specs use,
 * paused in the inspector. Not a test: `npm run preview` runs it, and any other run skips it.
 */
test('preview', async ({ page }) => {
  test.skip(!process.env['PREVIEW'], 'run with `npm run preview`');
  test.setTimeout(0);
  await page.goto('/');
  await page.pause();
});
