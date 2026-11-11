import { Page } from '@playwright/test';

import { Control } from '../../src/app/core/api/api.types';
import { exampleNumber } from '../fixtures/examples';
import { glossary, label } from '../fixtures/glossary';
import {
  StoredRun,
  failedRun,
  manyViolations,
  outdatedRun,
  runningRun,
  succeededRun,
  timedOutRun,
} from '../fixtures/runs';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { FakeApi, problem } from '../support/routes';
import { shot } from '../support/shots';

const letters = t('common.markLetters').split(' ');
const RUN = 500;

function controlOf(api: FakeApi, number: 1 | 2 | 3 | 4 | 5 | 6): Control {
  const wanted = JSON.stringify(exampleNumber(number).definition);
  return api.controls.find((control) => JSON.stringify(control.definition) === wanted)!;
}

const rows = (page: Page) => page.getByTestId('result-row');
const breakdown = (page: Page) => page.getByTestId('breakdown-row');

async function open(page: Page, stored: StoredRun, query = ''): Promise<void> {
  await page.goto(`/runs/${stored.run.id}${query}`);
  await expect(page.getByTestId('page-title')).toHaveText(stored.run.controlName);
}

test.describe('run results', () => {
  test('a run with violations shows the control in words, the summary, the breakdown and a reason for every record', async ({ page, api }, testInfo) => {
    const example = exampleNumber(4);
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN));
    await open(page, stored);

    await expect(page.getByTestId('run-total')).toHaveText(String(example.expected.total));
    await expect(page.getByTestId('run-sentence').getByTestId('mark')).toHaveText(
      letters.slice(0, stored.run.conditions!.length),
    );
    await expect(breakdown(page)).toHaveCount(stored.run.conditions!.length);
    await expect(rows(page)).toHaveCount(example.expected.total);

    // each record carries the marks of the conditions it matched, in order, and its actual values are marked
    const order = stored.run.conditions!.map((condition) => condition.id);
    for (const violation of example.expected.violations) {
      const row = page.locator(`[data-testid="result-row"][data-key="${violation.key}"]`);
      await expect(row.getByTestId('reason').getByTestId('mark')).toHaveText(
        violation.matched.map((id) => letters[order.indexOf(id)]),
      );
    }
    const first = stored.results[0];
    const actual = first.reasons[0].textParts.find((part) => part.role === 'actual');
    if (actual) {
      await expect(rows(page).first().getByTestId('value').first()).toHaveText(actual.text);
    }
    await expect(page.getByTestId('table-range')).toHaveText(
      t('results.range', { from: 1, to: example.expected.total, total: example.expected.total }),
    );
    await shot(page, testInfo, 'results-violations');
  });

  test('a breakdown row filters the records by its condition, and says so on its mark everywhere', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN));
    await open(page, stored);
    const condition = stored.run.conditions!.find((entry) => entry.count! > 0 && entry.count! < stored.run.totalCount!)!;
    const row = page.locator(`[data-testid="breakdown-row"][data-node="${condition.id}"]`);

    await row.click();

    await expect(page).toHaveURL(new RegExp(`condition=${condition.id}`));
    await expect(rows(page)).toHaveCount(condition.count!);
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(row.getByTestId('mark')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('run-sentence').locator(`[data-node="${condition.id}"]`).getByTestId('mark')).toHaveAttribute(
      'data-state',
      'active',
    );

    await page.getByTestId('breakdown-all').click();
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    await expect(page).not.toHaveURL(/condition=/);
  });

  test('the search narrows the records, and a search that matches nothing says what it looked in', async ({ page, api }, testInfo) => {
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN));
    await open(page, stored);
    const identifying = glossary.entities.find((entity) => entity.key === stored.run.rootEntity)!.identifyingFields;
    const name = String(stored.results[3].display[identifying[1]]);
    const expected = stored.results.filter((row) =>
      `${identifying.map((field) => row.display[field]).join(' ')}\n${row.reasonText}`.includes(name),
    );

    await page.getByTestId('toolbar-search').fill(name);
    await expect(rows(page)).toHaveCount(expected.length);
    await expect(page).toHaveURL(/search=/);

    await page.getByTestId('toolbar-search').fill('zzz-no-such-record');
    const panel = page.getByTestId('no-match');
    await expect(panel).toContainText(t('results.noMatch.title', { term: 'zzz-no-such-record' }));
    await shot(page, testInfo, 'results-no-match');

    await panel.getByRole('button', { name: t('results.noMatch.clear'), exact: true }).click();
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    await expect(page.getByTestId('toolbar-search')).toHaveValue('');
  });

  test('the records page, and the address keeps the page, its size and the order through a reload', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 23) }));
    await open(page, stored, '?size=10');

    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByTestId('table-range')).toHaveText(t('results.range', { from: 1, to: 10, total: 23 }));
    await expect(page.getByTestId('page-previous')).toBeDisabled();

    await page.getByTestId('page-next').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('table-range')).toHaveText(t('results.range', { from: 11, to: 20, total: 23 }));
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results[10].key);

    await page.reload();
    await expect(page.getByTestId('table-range')).toHaveText(t('results.range', { from: 11, to: 20, total: 23 }));
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results[10].key);

    await page.getByTestId('page-next').click();
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByTestId('page-next')).toBeDisabled();
    if (testInfo.project.name === 'mobile') {
      await shot(page, testInfo, 'results-last-page');
    }
  });

  test('the first column sorts the records: up, down, and back to the order of the run', async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the header is a table header from 640px; a phone sorts by the select');
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 12) }));
    const identifying = glossary.entities.find((entity) => entity.key === stored.run.rootEntity)!.identifyingFields;
    const text = (index: number) => identifying.map((field) => stored.results[index].display[field]).join(' ');
    const sorted = stored.results.map((_, index) => text(index)).sort((a, b) => a.localeCompare(b, 'he'));
    await open(page, stored);
    const firstCell = () => rows(page).first().locator('td').first();
    const head = page.locator('th').first();

    await page.getByTestId('sort-display').click();
    await expect(page).toHaveURL(/sort=display/);
    await expect(head).toHaveAttribute('aria-sort', 'ascending');
    await expect(firstCell()).toHaveText(sorted[0].split(' ')[0]);

    await page.getByTestId('sort-display').click();
    await expect(page).toHaveURL(/dir=desc/);
    await expect(head).toHaveAttribute('aria-sort', 'descending');
    await expect(firstCell()).toHaveText(sorted.at(-1)!.split(' ')[0]);

    await page.getByTestId('sort-display').click();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results[0].key);
  });

  test('a phone sorts the records from a select in the toolbar', async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the select stands in for the table header below 640px');
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 12) }));
    await open(page, stored);
    const column = label(
      glossary.entities
        .find((entity) => entity.key === stored.run.rootEntity)!
        .fields.find((field) => field.key === glossary.entities.find((e) => e.key === stored.run.rootEntity)!.identifyingFields[0])!.label,
    );

    // the header is read and not seen at this width: its button must not be a stop the keyboard cannot see
    await expect(page.getByTestId('sort-display')).toBeHidden();

    await page.getByTestId('toolbar-filters-toggle').click();
    await page.getByTestId('sort-select').click();
    await page.getByRole('option', { name: t('results.sort.desc', { column }), exact: true }).click();

    await expect(page).toHaveURL(/sort=display&dir=desc|dir=desc&sort=display/);
  });

  test('the condition under the pointer fills its mark in the sentence, the breakdown and the reasons', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    await open(page, stored);
    const id = stored.run.conditions![1].id;
    const everywhere = page.locator(`[data-node="${id}"]`).getByTestId('mark');
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);

    await page.locator(`[data-testid="breakdown-row"][data-node="${id}"]`).hover();

    const states = () => everywhere.evaluateAll((marks) => marks.map((mark) => mark.getAttribute('data-state')));
    await expect.poll(async () => [...new Set(await states())]).toEqual(['traced']);
    expect((await states()).length).toBeGreaterThan(2);
  });

  test('a run that found nothing says so, with what was checked', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: [] }));
    await open(page, stored);

    const panel = page.getByTestId('state-no-violations');
    const entity = label(glossary.entities.find((candidate) => candidate.key === control.rootEntity)!.label.plural);
    await expect(panel).toContainText(t('results.none.title'));
    await expect(panel).toContainText(t('results.none.body', { entity }));
    // the panel stands in place of the breakdown and the table; the summary of the run stays
    await expect(page.getByTestId('run-total')).toHaveText('0');
    await expect(page.getByTestId('results-table')).toHaveCount(0);
    await expect(page.getByTestId('breakdown')).toHaveCount(0);
    await shot(page, testInfo, 'results-no-violations');
  });

  test('more violations than the cap: the exact total, how many are shown, and counts over all of them', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 20), totalAboveCap: 6412 }));
    await open(page, stored);

    await expect(page.getByTestId('cap-banner')).toContainText(t('errors.ROW_CAP_EXCEEDED.title', { total: '6,412', stored: '20' }));
    await expect(page.getByTestId('run-total')).toHaveText('6,412');
    await expect(breakdown(page).first().getByTestId('breakdown-count')).toHaveText('6,412');
    await expect(page.getByTestId('table-range')).toHaveText(t('results.range', { from: 1, to: 20, total: 20 }));
    await shot(page, testInfo, 'results-cap');

    // the search reads the stored records only: when it finds none, the screen says how far it looked
    await page.getByTestId('toolbar-search').fill('zzz-no-such-record');
    await expect(page.getByTestId('no-match')).toContainText(
      t('results.noMatch.bodyCapped', { total: '6,412', stored: '20' }),
    );
  });

  test('a run that timed out says after how long it stopped and what to do', async ({ page, api }, testInfo) => {
    const stored = api.addRun(timedOutRun(controlOf(api, 1), RUN));
    await open(page, stored);

    const panel = page.getByTestId('state-timed-out');
    await expect(panel).toContainText(t('errors.QUERY_TIMEOUT.title', { timeoutSeconds: 30 }));
    await expect(panel.getByRole('link', { name: t('results.actions.editConditions') })).toHaveAttribute(
      'href',
      `/controls/${stored.run.controlId}`,
    );
    await shot(page, testInfo, 'results-timed-out');
  });

  test('a run of an outdated definition names the condition by its mark', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const second = (control.definition.where.children[1] as { id: string }).id;
    const stored = api.addRun(outdatedRun(control, RUN, second));
    await open(page, stored);

    const panel = page.getByTestId('state-outdated');
    await expect(panel).toContainText(t('errors.CONTROL_DEFINITION_OUTDATED.title'));
    await expect(panel).toContainText(t('results.outdated.one', { marks: letters[1] }));
    // the panel says the control cannot run: the head must not offer to run it
    await expect(page.getByTestId('rerun')).toHaveCount(0);
    await expect(page.getByTestId('edit-control')).toBeVisible();
    await shot(page, testInfo, 'results-outdated');
  });

  test('a run that failed for another reason offers to run again, and a run in progress to look again', async ({ page, api }, testInfo) => {
    const failed = api.addRun(failedRun(controlOf(api, 1), RUN, 'DATABASE_UNAVAILABLE'));
    await open(page, failed);
    // the run is in the past: the panel says what stopped it then, not that the data is unavailable now
    await expect(page.getByTestId('state-failed')).toContainText(t('results.failed.reasons.DATABASE_UNAVAILABLE'));
    await expect(page.getByTestId('rerun')).toBeVisible();
    await shot(page, testInfo, 'results-failed');

    const running = api.addRun(runningRun(controlOf(api, 2), RUN + 1));
    await open(page, running);
    await expect(page.getByTestId('state-running')).toContainText(t('results.running.title'));
    // a run is on its way: the head offers no second one
    await expect(page.getByTestId('rerun')).toHaveCount(0);
    await shot(page, testInfo, 'results-running');
  });

  test('a run that cannot be started again says why, and its "try again" tries the run again', async ({ page, api }) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN));
    api.fail(`POST /controls/${control.id}/runs`, problem(503, 'DATABASE_UNAVAILABLE'));
    await open(page, stored);
    await page.getByTestId('rerun').click();
    const banner = page.getByTestId('error-banner');
    await expect(banner).toHaveAttribute('data-code', 'DATABASE_UNAVAILABLE');

    api.heal(`POST /controls/${control.id}/runs`);
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(page).not.toHaveURL(new RegExp(`/runs/${RUN}$`));
    expect(api.callsTo(`POST /controls/${control.id}/runs`)).toHaveLength(2);
  });

  test('running again waits on skeleton rows, then opens the new run', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { startedAt: '2026-11-09T07:12:00.000Z' }));
    api.delay(`POST /controls/${control.id}/runs`, 600);
    await open(page, stored);
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);

    await page.getByTestId('rerun').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('rerun')).toBeDisabled();
    await expect(page.getByTestId('rerun')).toContainText(t('results.actions.running'));
    await expect(page.getByTestId('rerun')).toBeFocused();
    await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
    await shot(page, testInfo, 'results-rerunning');

    await expect(page).not.toHaveURL(new RegExp(`/runs/${RUN}$`));
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(page.getByTestId('previous-run')).toHaveAttribute('href', `/runs/${RUN}`);
  });

  test('the head and skeleton bars stand while a run is read, and an unknown run is not found', async ({ page, api }, testInfo) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    api.delay(`GET /runs/${RUN}`, 500);
    await page.goto(`/runs/${RUN}`);
    await expect(page.getByTestId('results-loading')).toBeVisible();
    await shot(page, testInfo, 'results-loading');
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);

    await page.goto('/runs/987654');
    await expect(page.getByTestId('not-found')).toBeVisible();
    await shot(page, testInfo, 'results-not-found');

    await page.goto('/runs/not-a-number');
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('a glossary that cannot be read is said, and the stored results stay readable', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await open(page, stored);

    await expect(page.getByTestId('error-banner')).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    // without the glossary a record's number is still written digit for digit, never with a separator
    await expect(rows(page).first()).toContainText(stored.results[0].key);
    await expect(rows(page).first().getByTestId('reason').first()).toContainText(stored.results[0].reasons[0].text);
  });

  test('rows that cannot be read leave the failure in place of a table that would wait forever', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    api.fail(`GET /runs/${RUN}/results`, problem(400, 'REQUEST_INVALID'));
    await open(page, stored);

    await expect(page.getByTestId('error-banner')).toHaveAttribute('data-code', 'REQUEST_INVALID');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(page.getByTestId('results-table')).toHaveAttribute('aria-busy', 'false');
  });

  test('a run of an archived control cannot be run again, and the screen says why', async ({ page, api }) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN));
    api.fail(`POST /controls/${control.id}/runs`, problem(409, 'CONTROL_ARCHIVED', { id: control.id }));
    await open(page, stored);

    await page.getByTestId('rerun').click();

    await expect(page.getByTestId('archived-banner')).toContainText(t('errors.CONTROL_ARCHIVED.title'));
    await expect(page.getByTestId('error-banner')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
  });
});
