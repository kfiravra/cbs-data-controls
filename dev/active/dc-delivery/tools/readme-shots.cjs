// The five README screenshots, taken on a list that holds only the six examples (night brief, change e).
// Run after `scripts/examples.py verify` and before any gate spec:
//   node dev/active/dc-delivery/tools/readme-shots.cjs <example id> [base url]
// The example id names the file of contracts/examples whose control the editor and results shots show (the
// shots of 2026-11-12 used missing-mandatory-data: nested groups and ten records).
// It reads through the interface and the api's GET endpoints only; it creates, changes and runs nothing.
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = createRequire(path.join(root, 'web', 'package.json'))('@playwright/test');
const exampleId = process.argv[2];
const base = process.argv[3] || 'http://localhost:5000';
const out = path.join(root, 'docs', 'screenshots');
if (!exampleId) {
  console.error('usage: node readme-shots.cjs <example id> [base url]');
  process.exit(2);
}
const exampleFile = require(path.join(root, 'contracts', 'examples', exampleId + '.json'));
const exampleName = Object.values(exampleFile.name)[0];

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.waitForTimeout(400);
}

async function shoot(page, name) {
  const panelOpen = (await page.locator('[data-testid="panel"], [data-testid="suggestions-dialog"]').count()) > 0;
  await page.screenshot({ path: path.join(out, name), fullPage: !panelOpen, animations: 'disabled' });
  console.log('shot ' + name);
}

(async () => {
  const listing = await (await fetch(base + '/api/v1/controls?active=all&pageSize=200')).json();
  const tagged = listing.items.filter((item) => / e2e-[0-9a-z]{6}/.test(item.name));
  if (listing.total !== 6 || tagged.length > 0) {
    throw new Error('the list is not clean: ' + listing.total + ' controls, ' + tagged.length + ' with a test tag');
  }
  const example = listing.items.find((item) => item.name === exampleName);
  if (!example || !example.lastRun) throw new Error(exampleId + ' is missing or has no run: run examples.py verify first');

  const browser = await chromium.launch();
  const common = { baseURL: base, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' };

  const desktop = await browser.newContext({ ...common, viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.goto('/');
  await page.getByTestId('tab-active').waitFor();
  await settle(page);
  await shoot(page, 'list.png');

  await page.goto('/controls/' + example.id);
  await page.getByTestId('panel').waitFor();
  await page.locator('[data-testid="sentence"][data-stale="false"]').waitFor();
  await settle(page);
  await shoot(page, 'editor.png');

  await page.goto('/runs/' + example.lastRun.id);
  await page.getByTestId('panel').waitFor();
  await settle(page);
  await shoot(page, 'results.png');

  await page.goto('/');
  await page.getByTestId('tab-active').waitFor();
  await page.getByTestId('open-suggestions').click();
  await page.getByTestId('suggestions-dialog').getByTestId('suggestion').first().waitFor();
  await settle(page);
  await shoot(page, 'suggestions.png');
  await desktop.close();

  const mobile = await browser.newContext({ ...common, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const phone = await mobile.newPage();
  await phone.goto('/runs/' + example.lastRun.id);
  await phone.getByTestId('panel').waitFor();
  await settle(phone);
  await shoot(phone, 'results-mobile.png');
  await phone.goto('/');
  await phone.getByTestId('tab-active').waitFor();
  await settle(phone);
  await shoot(phone, 'list-mobile.png');
  await mobile.close();
  await browser.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
