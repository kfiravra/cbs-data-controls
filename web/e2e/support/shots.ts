import { Page, TestInfo } from '@playwright/test';
import { join } from 'node:path';

/**
 * Saves a PNG as `e2e/screenshots/<project>/<name>.png`: the whole page when the list stands alone, and the
 * window when a panel is open over it (the panel is as tall as the window and scrolls inside itself, so a
 * picture of the whole page would show the list running on under it). No `toHaveScreenshot` baselines: they
 * are per-OS and font-sensitive. The shot waits for the fonts, so it never shows a fallback face.
 */
export async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const panelOpen = (await page.locator('[data-testid="panel"], [data-testid="suggestions-dialog"]').count()) > 0;
  await page.screenshot({
    path: join(__dirname, '..', 'screenshots', testInfo.project.name, `${name}.png`),
    fullPage: !panelOpen,
    animations: 'disabled',
  });
}

/** The room the panel leaves around itself: none on a phone, where it is the whole window. */
export function sheetInset(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-inset')) || 0);
}

/**
 * Waits until what moves has come to rest: a panel slides in, and a box measured meanwhile is on its way.
 * Call it once the thing to measure is in the page: before that there is no animation to wait for.
 */
export function atRest(page: Page): Promise<void> {
  return page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished));
  });
}
