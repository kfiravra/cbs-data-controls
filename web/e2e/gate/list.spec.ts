import { exampleNumber } from '../fixtures/examples';
import { controlIdOf, expect, test } from '../support/gate';
import { t } from '../support/i18n';
import { shot } from '../support/shots';

/**
 * The list on the real stack, on a control of the test's own (example 4, created through the api: building
 * through the interface is proven by examples.spec.ts). Nothing here counts, orders or pages the list as a
 * whole, and a row is found by a search for the control's full name and then by its id.
 */
test('a control of its own is found, run from its row, filtered in its results, duplicated and archived', async ({ page, gate }, testInfo) => {
  const example = exampleNumber(4);
  const rows = page.getByTestId('control-row');
  const records = page.getByTestId('result-row');

  await page.goto('/');
  await expect(page.getByTestId('page-meta')).toBeVisible();
  await shot(page, testInfo, 'gate-list');

  const control = await gate.create(example);
  const row = page.locator(`[data-testid="control-row"][data-id="${control.id}"]`);

  await test.step('found by its full name, then by its id', async () => {
    await page.getByTestId('toolbar-search').fill(control.name);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('control-link')).toHaveText(control.name);
    await expect(row.getByTestId('control-link')).toHaveAttribute('href', `/controls/${control.id}`);
    await expect(row.getByTestId('last-run')).toHaveText(t('list.neverRun'));
  });

  await test.step('run from its row: the result lands on the row', async () => {
    await row.getByTestId('run').click();
    const result = row.getByTestId('result').getByRole('link');
    await expect(result).toHaveText(t('results.violations.other', { count: example.expected.total }));
    await expect(page).toHaveURL(/search=/);
    await result.click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(records).toHaveCount(example.expected.total);
  });

  await test.step('its results are searched and filtered by condition', async () => {
    const [wanted] = example.expected.violations;
    await page.getByTestId('toolbar-search').fill(wanted.key);
    await expect(records).toHaveCount(1);
    await expect(records).toHaveAttribute('data-key', wanted.key);
    await page.getByTestId('toolbar-search').fill('');
    await expect(records).toHaveCount(example.expected.total);

    // the control was created with the example's own definition, so its node ids are the example's
    const node = wanted.matched.at(-1)!;
    const matching = example.expected.violations.filter((violation) => violation.matched.includes(node));
    await page.locator(`[data-testid="breakdown-row"][data-node="${node}"]`).click();
    await expect(records).toHaveCount(matching.length);
    const keys = await records.evaluateAll((found) => found.map((record) => record.getAttribute('data-key')));
    expect(new Set(keys)).toEqual(new Set(matching.map((violation) => violation.key)));
  });

  let copy = 0;
  await test.step('duplicated: the copy keeps the tag in its name and is saved under its own id', async () => {
    await page.goto('/');
    await page.getByTestId('toolbar-search').fill(gate.tag);
    await expect(rows).toHaveCount(1);
    await row.getByTestId('duplicate').click();
    const name = t('editor.copyName', { name: control.name });
    await expect(page.getByTestId('control-name')).toHaveValue(name);
    expect(name).toContain(gate.tag);
    await page.getByTestId('save').click();
    await expect(page).toHaveURL(/\/controls\/\d+$/);
    copy = controlIdOf(page.url());
    gate.own(copy);
    expect(copy).not.toBe(control.id);
  });

  await test.step('archived: no active row carries the tag of this test any more', async () => {
    for (const id of [copy, control.id]) {
      await page.goto(`/controls/${id}`);
      await page.getByTestId('archive').click();
      await page.getByTestId('confirm-accept').click();
      await expect(page).toHaveURL(/\/$/);
    }
    await page.getByTestId('toolbar-search').fill(gate.tag);
    await expect(page.getByTestId('no-match')).toBeVisible();
    await expect(rows).toHaveCount(0);
  });
});
