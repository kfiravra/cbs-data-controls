import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { shot } from '../support/shots';

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
});
