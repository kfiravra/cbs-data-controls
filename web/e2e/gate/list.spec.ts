import { exampleNumber } from '../fixtures/examples';
import { controlIdOf, expect, test } from '../support/gate';
import { t } from '../support/i18n';
import { shot } from '../support/shots';

/**
 * The one page on the real stack, on a control of the test's own (example 4, created through the api:
 * building through the interface is proven by examples.spec.ts). Nothing here counts, orders or pages the
 * list as a whole, and a row is found by a search for the control's full name and then by its id.
 */
test('a control of its own is found, opened, run, read in its panel, duplicated and archived from its row', async ({ page, gate }, testInfo) => {
  const example = exampleNumber(4);
  const rows = page.getByTestId('control-row');
  const panel = page.getByTestId('panel');
  const records = panel.getByTestId('result-row');

  await page.goto('/');
  await expect(page.getByTestId('tab-active').getByTestId('tab-count')).toBeVisible();
  await shot(page, testInfo, 'gate-list');

  const control = await gate.create(example);
  const row = page.locator(`[data-testid="control-row"][data-id="${control.id}"]`);

  await test.step('found by its full name, then by its id; its name leads to its results, where it never ran', async () => {
    await page.getByTestId('toolbar-search').fill(control.name);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('control-link')).toHaveText(control.name);
    await expect(row.getByTestId('last-run')).toHaveText(t('list.neverRun'));
    await row.getByTestId('control-link').click();
    await expect(page).toHaveURL(new RegExp(`/controls/${control.id}/runs$`));
    await expect(panel.getByTestId('state-never-run')).toContainText(t('results.never.title'));
    // the rule in words comes from the real engine
    await expect(panel.getByTestId('run-sentence').getByTestId('mark').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    // the list kept its search under the panel, and has the focus back on the row
    await expect(page).toHaveURL(/search=/);
    await expect(row.getByTestId('control-link')).toBeFocused();
  });

  await test.step('run from its row: the result lands on the row, and the name now opens that run', async () => {
    await row.getByTestId('run').click();
    const result = row.getByTestId('result').getByRole('link');
    await expect(result).toHaveText(t('results.violations.other', { count: example.expected.total }));
    await expect(page).toHaveURL(/search=/);
    await row.getByTestId('control-link').click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(panel.getByTestId('panel-title')).toHaveText(control.name);
    await expect(records).toHaveCount(example.expected.total);
  });

  await test.step('its results are searched and filtered by condition', async () => {
    const [wanted] = example.expected.violations;
    await panel.getByTestId('toolbar-search').fill(wanted.key);
    await expect(records).toHaveCount(1);
    await expect(records).toHaveAttribute('data-key', wanted.key);
    await panel.getByTestId('toolbar-search').fill('');
    await expect(records).toHaveCount(example.expected.total);

    // the control was created with the example's own definition, so its node ids are the example's
    const node = wanted.matched.at(-1)!;
    const matching = example.expected.violations.filter((violation) => violation.matched.includes(node));
    await panel.locator(`[data-testid="breakdown-row"][data-node="${node}"]`).click();
    await expect(records).toHaveCount(matching.length);
    const keys = await records.evaluateAll((found) => found.map((record) => record.getAttribute('data-key')));
    expect(new Set(keys)).toEqual(new Set(matching.map((violation) => violation.key)));
  });

  await test.step('run again in the panel: the picker then holds both runs, and the earlier one is shown on request', async () => {
    const first = page.url().match(/\/runs\/(\d+)/)![1];
    await expect(panel.getByTestId('run-picker')).toHaveCount(0);
    await panel.getByTestId('rerun').click();
    await expect(page).not.toHaveURL(new RegExp(`/runs/${first}(\\?|$)`));
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(records).toHaveCount(example.expected.total);

    await panel.getByTestId('run-picker').click();
    const options = page.getByTestId('run-option');
    await expect(options).toHaveCount(2);
    await options.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${first}$`));
    await expect(records).toHaveCount(example.expected.total);
    await shot(page, testInfo, 'gate-panel');

    await panel.getByTestId('panel-close').click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/search=/);
  });

  let copy = 0;
  await test.step('duplicated: the copy keeps the tag in its name and is saved under its own id', async () => {
    await page.goto('/');
    await page.getByTestId('toolbar-search').fill(gate.tag);
    await expect(rows).toHaveCount(1);
    await row.getByTestId('duplicate').click();
    const name = t('editor.copyName', { name: control.name });
    await expect(panel.getByTestId('control-name')).toHaveValue(name);
    expect(name).toContain(gate.tag);
    await panel.getByTestId('save').click();
    await expect(page).toHaveURL(/\/controls\/\d+$/);
    copy = controlIdOf(page.url());
    gate.own(copy);
    expect(copy).not.toBe(control.id);
    await panel.getByTestId('panel-close').click();
    await expect(panel).toHaveCount(0);
  });

  await test.step('archived from their rows: no active row carries the tag any more, and the archive holds both', async () => {
    await expect(rows).toHaveCount(2);
    for (const id of [copy, control.id]) {
      const own = page.locator(`[data-testid="control-row"][data-id="${id}"]`);
      await own.getByTestId('archive').click();
      await expect(page.getByTestId('confirm-dialog')).toContainText(gate.tag);
      await page.getByTestId('confirm-accept').click();
      await expect(own).toHaveCount(0);
    }
    await expect(page.getByTestId('no-match')).toBeVisible();
    await expect(rows).toHaveCount(0);

    // only the controls are archived: the runs are kept, and the name of the control still opens its last one
    await page.getByTestId('tab-archived').click();
    await expect(rows).toHaveCount(2);
    await expect(row.getByTestId('run')).toHaveCount(0);
    await row.getByTestId('control-link').click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(records).toHaveCount(example.expected.total);
  });
});
