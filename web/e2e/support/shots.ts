import { Page, TestInfo } from '@playwright/test';
import { join } from 'node:path';

/**
 * Saves a full-page PNG as `e2e/screenshots/<project>/<name>.png`. No `toHaveScreenshot` baselines: they
 * are per-OS and font-sensitive. The shot waits for the fonts, so it never shows a fallback face.
 */
export async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(__dirname, '..', 'screenshots', testInfo.project.name, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}
