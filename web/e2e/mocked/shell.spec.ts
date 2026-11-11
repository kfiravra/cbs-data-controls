import { Page } from '@playwright/test';

import { exampleNumber } from '../fixtures/examples';
import { succeededRun } from '../fixtures/runs';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { atRest, shot } from '../support/shots';

/** What is wider than its scroller: the page itself, and anything inside a panel's body. */
async function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const wide: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) {
      wide.push(`the page: ${root.scrollWidth} in ${root.clientWidth}`);
    }
    for (const body of document.querySelectorAll<HTMLElement>('[data-testid="panel-body"]')) {
      if (body.scrollWidth > body.clientWidth) {
        wide.push(`a panel's body: ${body.scrollWidth} in ${body.clientWidth}`);
      }
    }
    return wide;
  });
}

test.describe('shell', () => {
  test('opens in Hebrew, right to left, with its own font and no failed request', async ({ page }, testInfo) => {
    const failed: string[] = [];
    page.on('requestfailed', (request) => failed.push(request.url()));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/no-such-page');

    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('brand')).toHaveText(t('app.name'));
    await expect(page).toHaveTitle(t('app.title', { app: t('app.name'), page: t('states.notFound.title') }));

    await page.evaluate(() => document.fonts.ready);
    // checked against Hebrew text: without it only the face that covers a space is tested
    const fontLoaded = await page.evaluate(
      (sample) => [400, 500].every((weight) => document.fonts.check(`${weight} 16px "Heebo"`, sample)),
      t('app.name'),
    );
    expect(fontLoaded).toBe(true);
    expect(failed).toEqual([]);

    await shot(page, testInfo, 'shell-not-found');
  });

  test('shows the not-found state for an unknown address and leads back to the list', async ({ page }) => {
    await page.goto('/no-such-page');

    const panel = page.getByTestId('not-found');
    await expect(panel.getByRole('heading', { name: t('states.notFound.title'), exact: true })).toBeVisible();

    await panel.getByRole('link', { name: t('states.notFound.toList'), exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('on a phone a row is a card, a panel is the whole window, its bar stays in reach, and nothing scrolls sideways', async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    const wanted = JSON.stringify(exampleNumber(4).definition);
    const control = api.controls.find((candidate) => JSON.stringify(candidate.definition) === wanted)!;
    api.addRun(succeededRun(control, 501));
    const viewport = page.viewportSize()!;

    // the list: every row a card as wide as the page lets it, one under the other
    await page.goto('/');
    const rows = page.getByTestId('control-row');
    await expect(rows.first()).toBeVisible();
    const [first, second] = [(await rows.nth(0).boundingBox())!, (await rows.nth(1).boundingBox())!];
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(first.width).toBeGreaterThan(viewport.width - 48);
    await expect(page.locator('thead')).not.toBeInViewport();
    await expect(page.getByTestId('table-range')).toBeInViewport({ ratio: 1 });
    expect(await sideways(page)).toEqual([]);

    // the results: the whole window, the count and the pager at its foot whatever is scrolled
    await page.goto('/runs/501');
    const panel = page.getByTestId('panel');
    await expect(panel.getByTestId('result-row').first()).toBeVisible();
    await atRest(page);
    const sheet = (await panel.boundingBox())!;
    expect({ x: Math.round(sheet.x), y: Math.round(sheet.y), width: Math.round(sheet.width), height: Math.round(sheet.height) }).toEqual({
      x: 0,
      y: 0,
      ...viewport,
    });
    await panel.getByTestId('panel-body').evaluate((body) => body.scrollTo(0, body.scrollHeight));
    await expect(panel.getByTestId('table-range')).toBeInViewport({ ratio: 1 });
    await expect(panel.getByTestId('panel-close')).toBeInViewport({ ratio: 1 });
    const records = panel.getByTestId('result-row');
    expect((await records.nth(1).boundingBox())!.y).toBeGreaterThanOrEqual(
      (await records.nth(0).boundingBox())!.y + (await records.nth(0).boundingBox())!.height,
    );
    expect(await sideways(page)).toEqual([]);
    await shot(page, testInfo, 'phone-results');

    // the editor: the whole window, the rule in words and the save at its foot whatever is scrolled
    await page.goto(`/controls/${control.id}`);
    await expect(panel.getByTestId('condition-row').first()).toBeVisible();
    await panel.getByTestId('panel-body').evaluate((body) => body.scrollTo(0, body.scrollHeight));
    await expect(panel.getByTestId('save')).toBeInViewport({ ratio: 1 });
    await expect(panel.getByTestId('save-run')).toBeInViewport({ ratio: 1 });
    await expect(panel.getByTestId('sentence-field')).toBeInViewport({ ratio: 1 });
    expect(await sideways(page)).toEqual([]);
    await shot(page, testInfo, 'phone-editor');
  });
});
