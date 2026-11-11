import { glossary, label } from '../fixtures/glossary';
import { manyViolations, succeededRun } from '../fixtures/runs';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { RUN, controlOf, open, rows, ui } from '../support/results-screen';
import { shot } from '../support/shots';

test.describe('run results: the order of the records and the layout of the panel', () => {
  test('every column sorts the records on a click of its name: up, down, and back to the order of the run', async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the header is a table header from 640px; a phone sorts by the select');
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 12) }));
    const entity = glossary.entities.find((candidate) => candidate.key === stored.run.rootEntity)!;
    const [first, ...others] = entity.identifyingFields;
    const number = entity.identifyingFields.find((key) => entity.fields.find((field) => field.key === key)!.type === 'number')!;
    await open(page, stored);
    const head = (column: string) => ui(page).locator(`[data-column="${column}"]`).getByTestId('sort-header');
    const cell = (column: string) => ui(page).locator('th', { has: page.locator(`[data-column="${column}"]`) });
    const asked = () => {
      const query = api.callsTo(`GET /runs/${stored.run.id}/results`).at(-1)!.query;
      return [query.get('sort'), query.get('field'), query.get('dir')].join(':');
    };
    const texts = stored.results.map((row) => String(row.display[first])).sort((a, b) => a.localeCompare(b, 'he'));

    // every identifying field has a head that sorts, and so do the reasons
    await expect(ui(page).getByTestId('sort-header')).toHaveCount(entity.identifyingFields.length + 1);

    await head(first).click();
    await expect(page).toHaveURL(new RegExp(`sort=${first}`));
    await expect(cell(first)).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(asked).toBe(`field:${first}:asc`);
    await expect(rows(page).first().locator('td').first()).toHaveText(texts[0]);

    await head(first).click();
    await expect(page).toHaveURL(/dir=desc/);
    await expect(cell(first)).toHaveAttribute('aria-sort', 'descending');
    await expect(rows(page).first().locator('td').first()).toHaveText(texts.at(-1)!);

    await head(first).click();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results[0].key);

    // a number sorts by its value, largest first when asked downwards
    await head(number).click();
    await head(number).click();
    await expect.poll(asked).toBe(`field:${number}:desc`);
    const largest = Math.max(...stored.results.map((row) => Number(row.display[number])));
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results.find((row) => Number(row.display[number]) === largest)!.key);
    await expect(ui(page).locator('th[aria-sort="descending"], th[aria-sort="ascending"]')).toHaveCount(1);

    // the other fields and the reasons ask the server the same way
    for (const field of others) {
      await head(field).click();
      await expect.poll(asked).toBe(`field:${field}:asc`);
    }
    await head('_reasons').click();
    await expect(page).toHaveURL(/sort=_reasons/);
    await expect.poll(asked).toBe('reasons::asc');
    await expect(cell('_reasons')).toHaveAttribute('aria-sort', 'ascending');
    const fewest = Math.min(...stored.results.map((row) => row.reasons.length));
    await expect(rows(page).first().getByTestId('reason')).toHaveCount(fewest);

    // the address keeps the order over a reload
    await page.reload();
    await expect(cell('_reasons')).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(asked).toBe('reasons::asc');
  });

  test('a phone sorts the records from a select in the toolbar, by any column', async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the select stands in for the table header below 640px');
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 12) }));
    await open(page, stored);
    const entity = glossary.entities.find((candidate) => candidate.key === stored.run.rootEntity)!;
    const second = entity.identifyingFields[1];
    const column = label(entity.fields.find((field) => field.key === second)!.label);

    // the heads are read and not seen at this width: their buttons must not be stops the keyboard cannot see
    await expect(ui(page).getByTestId('sort-header').first()).toBeHidden();

    await ui(page).getByTestId('toolbar-filters-toggle').click();
    await ui(page).getByTestId('sort-select').click();
    // the run's order, and two directions for every identifying field and for the reasons
    await expect(page.getByRole('option')).toHaveCount(1 + 2 * (entity.identifyingFields.length + 1));
    await page.getByRole('option', { name: t('results.sort.desc', { column }), exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`sort=${second}&dir=desc|dir=desc&sort=${second}`));
    const query = api.callsTo(`GET /runs/${stored.run.id}/results`).at(-1)!.query;
    expect([query.get('sort'), query.get('field'), query.get('dir')]).toEqual(['field', second, 'desc']);

    await ui(page).getByTestId('sort-select').click();
    await page.getByRole('option', { name: t('results.sort.asc', { column: t('results.table.reasons') }), exact: true }).click();
    await expect(page).toHaveURL(/sort=_reasons/);
  });

  test('the panel reads from the top: the rule on a tint, one block for the run and its filter, the records as wide as the panel, and the pager at the foot', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 4);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 60) }));
    await open(page, stored);
    const box = async (testId: string) => (await ui(page).getByTestId(testId).boundingBox())!;
    const [rule, summary, table, body] = [await box('run-sentence'), await box('run-summary'), await box('results-table'), await box('panel-body')];

    // top to bottom: the rule, the one block, the records
    expect(rule.y + rule.height).toBeLessThanOrEqual(summary.y);
    expect(summary.y + summary.height).toBeLessThanOrEqual(table.y);
    // the rule stands on a tint of its own, and the count is said once: beside the filter, not also in it
    const tint = await ui(page).locator('.rule').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(tint).not.toBe(await ui(page).getByTestId('panel-body').evaluate((element) => getComputedStyle(element).backgroundColor));
    await expect(ui(page).getByTestId('run-summary').getByTestId('breakdown')).toBeVisible();
    await expect(ui(page).getByTestId('breakdown-all')).toHaveText(t('results.breakdown.all'));
    await expect(ui(page).getByTestId('breakdown-all').getByTestId('breakdown-count')).toHaveCount(0);
    await expect(ui(page).getByTestId('run-total')).toHaveText(String(stored.run.totalCount));
    // the records take the whole width the panel gives its content, like the two blocks over them
    expect(Math.round(table.width)).toBe(Math.round(summary.width));
    expect(table.width).toBeGreaterThan(body.width * 0.85);

    // the letters of the rule are small, and sit over the start of their clause
    const mark = ui(page).getByTestId('run-sentence').getByTestId('mark').first();
    const clause = ui(page).getByTestId('run-sentence').getByTestId('clause').first();
    const [markBox, clauseBox] = [(await mark.boundingBox())!, (await clause.boundingBox())!];
    const inReason = (await rows(page).first().getByTestId('mark').first().boundingBox())!;
    expect(markBox.height).toBeLessThan(inReason.height);
    expect(markBox.height).toBeLessThanOrEqual(13);
    // a superscript: over the start corner of its clause, and out of the line (it takes no room in it)
    expect(markBox.y).toBeLessThan(clauseBox.y + 2);
    expect(Math.abs(markBox.x + markBox.width - (clauseBox.x + clauseBox.width))).toBeLessThanOrEqual(6);
    expect(await mark.evaluate((element) => getComputedStyle(element).position)).toBe('absolute');
    const word = ui(page).getByTestId('run-sentence').locator('.marked').first();
    expect(Math.round((await word.boundingBox())!.x + (await word.boundingBox())!.width)).toBe(Math.round(clauseBox.x + clauseBox.width));

    // the count and the pager are in view however far the records are scrolled
    const viewport = page.viewportSize()!;
    const foot = await box('table-range');
    expect(foot.y + foot.height).toBeLessThanOrEqual(viewport.height);
    await ui(page).getByTestId('panel-body').evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(ui(page).getByTestId('table-range')).toBeInViewport({ ratio: 1 });
    await expect(ui(page).getByTestId('page-next')).toBeInViewport({ ratio: 1 });
    expect(await box('table-range')).toEqual(foot);
    await shot(page, testInfo, 'results-foot');
  });
});
