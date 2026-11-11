import { ControlSummary, Page, ResultItem } from '../../src/app/core/api/api.types';
import { exampleNumber } from '../fixtures/examples';
import { controlIdOf, expect, test } from '../support/gate';
import { t } from '../support/i18n';
import { shot } from '../support/shots';

/**
 * The one page on the real stack, on a control of the test's own (example 4, created through the api:
 * building through the interface is proven by examples.spec.ts). Nothing here counts or pages the list as a
 * whole, and a row is found by a search for the control's full name and then by its id. One step sorts the
 * whole list: it asserts no control in particular, only that the page shows the order the api gives and
 * that the order is the contract's.
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
    await expect(row.getByTestId('status-chip')).toHaveText(t('list.neverRun'));
    await row.getByTestId('control-link').click();
    await expect(page).toHaveURL(new RegExp(`/controls/${control.id}/runs$`));
    await expect(panel.getByTestId('state-never-run')).toContainText(t('results.never.title'));
    // the rule in words comes from the real engine
    await expect(panel.getByTestId('run-sentence').locator('[data-testid="clause"][data-tone="1"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    // the list kept its search under the panel, and has the focus back on the row
    await expect(page).toHaveURL(/search=/);
    await expect(row.getByTestId('control-link')).toBeFocused();
  });

  await test.step('run from its row: the result lands on the row, in the red of violations, and the whole of its details now opens that run', async () => {
    await row.getByTestId('run').click();
    const result = row.getByTestId('status-chip');
    await expect(result).toHaveText(t('results.violations.other', { count: example.expected.total }));
    await expect(result).toHaveClass(/status-chip--violations/);
    await expect(page).toHaveURL(/search=/);
    // not the name: a click on what the run found, which the row's one link covers
    await result.click({ force: true });
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

  await test.step('its results are sorted by the server on any column: here by the reasons, most first', async () => {
    await panel.getByTestId('toolbar-search').fill('');
    await panel.locator(`[data-testid="breakdown-all"]`).click();
    await expect(records).toHaveCount(example.expected.total);
    if (testInfo.project.name === 'mobile') {
      await panel.getByTestId('toolbar-filters-toggle').click();
      await panel.getByTestId('sort-select').click();
      await page.getByRole('option', { name: t('results.sort.desc', { column: t('results.table.reasons') }), exact: true }).click();
    } else {
      const head = panel.locator('[data-column="_reasons"]').getByTestId('sort-header');
      await head.click();
      await head.click();
    }
    await expect(page).toHaveURL(/sort=_reasons&dir=desc|dir=desc&sort=_reasons/);

    // the panel shows the order the api gives, and that order is the contract's: more reasons first
    const run = page.url().match(/\/runs\/(\d+)/)![1];
    const answer = await page.request.get(`/api/v1/runs/${run}/results?sort=reasons&dir=desc&page=1&pageSize=25`);
    const { items } = (await answer.json()) as Page<ResultItem>;
    await expect(records.first()).toHaveAttribute('data-key', items[0].key);
    expect(await records.evaluateAll((found) => found.map((record) => record.getAttribute('data-key')))).toEqual(items.map((item) => item.key));
    const counts = items.map((item) => item.reasons.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));

    // an identifying field the same way: the api reads it by the glossary and answers 200
    const field = Object.keys(items[0].display)[0];
    const byField = await page.request.get(`/api/v1/runs/${run}/results?sort=field&field=${field}&page=1&pageSize=25`);
    expect(byField.status()).toBe(200);
    const refused = await page.request.get(`/api/v1/runs/${run}/results?sort=field&field=no_such_field`);
    expect(refused.status()).toBe(400);
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

  await test.step('sorted by the server: the list by violations, most first, with what has no count last', async () => {
    await page.goto('/');
    await expect(rows.first()).toBeVisible();
    if (testInfo.project.name === 'mobile') {
      await page.getByTestId('toolbar-filters-toggle').click();
      await page.getByTestId('sort-select').click();
      await page.getByRole('option', { name: t('list.sort.desc', { column: t('list.columns.result') }), exact: true }).click();
    } else {
      const head = page.locator('[data-column="violations"]').getByTestId('sort-header');
      await head.click();
      await expect(page).toHaveURL(/sort=violations/);
      await head.click();
    }
    await expect(page).toHaveURL(/sort=violations&dir=desc|dir=desc&sort=violations/);

    // the page shows the order the api gives, and that order is the contract's
    const answer = await page.request.get('/api/v1/controls?active=true&sort=violations&dir=desc&page=1&pageSize=25');
    const { items } = (await answer.json()) as Page<ControlSummary>;
    await expect(rows).toHaveCount(items.length);
    expect(await rows.evaluateAll((found) => found.map((item) => Number(item.getAttribute('data-id'))))).toEqual(
      items.map((item) => item.id),
    );
    const place = (item: ControlSummary) => (item.lastRun === null ? 2 : item.lastRun.totalCount === null ? 1 : 0);
    expect(items.map(place)).toEqual([...items.map(place)].sort((a, b) => a - b));
    const counts = items.filter((item) => place(item) === 0).map((item) => item.lastRun!.totalCount!);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts.length).toBeGreaterThan(0);
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
    // the archive behaves as the active list does, less the run and the edit: a row per control, in the
    // archive's grey, that opens its last run, where the picker still moves to the earlier one
    await page.getByTestId('tab-archived').click();
    await expect(rows).toHaveCount(2);
    await expect(row.getByTestId('run')).toHaveCount(0);
    await expect(row.getByTestId('edit')).toHaveCount(0);
    await expect(row.getByTestId('status-chip')).toHaveText(t('results.violations.other', { count: example.expected.total }));
    await expect(row.getByTestId('status-chip')).toHaveClass('status-chip');
    await row.getByTestId('control-link').click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(records).toHaveCount(example.expected.total);
    await expect(panel.getByTestId('archived-chip')).toBeVisible();
    await expect(panel.getByTestId('rerun')).toHaveCount(0);
    await expect(panel.getByTestId('edit-control')).toHaveCount(0);
    await panel.getByTestId('run-picker').click();
    await expect(page.getByTestId('run-option')).toHaveCount(2);
    await page.getByTestId('run-option').nth(1).click();
    await expect(records).toHaveCount(example.expected.total);
    await expect(panel.getByTestId('archived-chip')).toBeVisible();
  });
});
