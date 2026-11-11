import { joiningWord } from '../../src/app/core/glossary/glossary.phrases';
import { glossary, label } from '../fixtures/glossary';
import { manyViolations, succeededRun } from '../fixtures/runs';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { RUN, controlOf, open, rows, ui } from '../support/results-screen';
import { groundOf, lineOf, ruleTones, strengthOf } from '../support/rule';
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

    // the list of the first choice is gone before the select is pressed again: a press while it closes opens nothing
    await expect(page.getByRole('listbox')).toHaveCount(0);
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

    // the rule is plain text: no letter in it and no ground under a word; each condition's words carry the
    // colour its letter has on its chip and beside its reasons
    const sentence = ui(page).getByTestId('run-sentence');
    await expect(sentence.getByTestId('mark')).toHaveCount(0);
    const first = sentence.getByTestId('clause').first();
    const node = (await first.getAttribute('data-node'))!;
    expect(await first.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    // as the browser paints them: the solid stretch of the line, and the ground of each letter
    const underline = await lineOf(first);
    const chip = ui(page).locator(`[data-testid="breakdown-row"][data-node="${node}"]`).getByTestId('mark');
    const reason = ui(page).locator(`[data-testid="reason"][data-node="${node}"]`).first().getByTestId('mark');
    expect(strengthOf(underline)).toBeCloseTo(0.5, 1);
    expect(await groundOf(chip)).toBe(underline);
    expect(await groundOf(reason)).toBe(underline);
    // and the next condition has another colour
    expect(await lineOf(sentence.getByTestId('clause').nth(1))).not.toBe(underline);
    // the line under the words is drawn (it fades at its ends), and the sentence is set as body text is
    expect(await first.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('linear-gradient');
    expect(await sentence.evaluate((element) => getComputedStyle(element).fontWeight)).toBe('400');

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

  test('a rule with groups is drawn as lines: no bracket, no tint, a group inside a group one step in and led by its joining word, and the plain sentence to be read', async ({ page, api }) => {
    // example 4: (one condition and (three joined by or)) or (two joined by and)
    const control = controlOf(api, 4);
    const stored = api.addRun(succeededRun(control, RUN));
    await open(page, stored);
    const sentence = ui(page).getByTestId('run-sentence');
    const lines = sentence.getByTestId('rule-line');
    const or = label(joiningWord(glossary, 'or')).trim();
    const and = label(joiningWord(glossary, 'and')).trim();

    // the first group's own condition, the group inside it one step in, and the second group back at the edge
    await expect(lines).toHaveCount(3);
    expect(await lines.evaluateAll((all) => all.map((line) => Number(line.getAttribute('data-depth'))))).toEqual([0, 1, 0]);
    const starts = await lines.evaluateAll((all) => all.map((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      const box = range.getBoundingClientRect();
      return Math.round(box.x + box.width);
    }));
    // a line one step in starts further from the edge (the start edge is the right one here)
    expect(starts[1]).toBeLessThan(starts[0]);
    expect(starts[2]).toBe(starts[0]);
    // every group's line is led by the word that joins it, and no line ends with one
    const texts = (await lines.allInnerTexts()).map((text) => text.trim());
    expect(texts[1].startsWith(`${and} `)).toBe(true);
    expect(texts[2].startsWith(`${or} `)).toBe(true);
    expect(texts.some((text) => text.endsWith(` ${and}`) || text.endsWith(` ${or}`))).toBe(false);
    // what is drawn holds no bracket and no ground of its own; what is read holds the engine's sentence
    const drawn = sentence.getByTestId('drawn-text');
    expect(await drawn.innerText()).not.toMatch(/[()]/);
    const grounds = await drawn.locator('*').evaluateAll((all) => [...new Set(all.map((element) => getComputedStyle(element).backgroundColor))]);
    expect(grounds).toEqual(['rgba(0, 0, 0, 0)']);
    expect(await sentence.getByTestId('plain-text').textContent()).toContain('(');
    await expect(drawn).toHaveAttribute('aria-hidden', 'true');
    // each condition's colour once, in the order of the rule: six conditions, the first six of the set
    await expect.poll(() => ruleTones(sentence)).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
