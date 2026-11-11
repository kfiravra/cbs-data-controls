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
import { sheetInset, shot } from '../support/shots';

const letters = t('common.markLetters').split(' ');
const RUN = 500;

function controlOf(api: FakeApi, number: 1 | 2 | 3 | 4 | 5 | 6): Control {
  const wanted = JSON.stringify(exampleNumber(number).definition);
  return api.controls.find((control) => JSON.stringify(control.definition) === wanted)!;
}

/** The panel: the list stands behind it with a toolbar, a table and a foot of its own, so everything is looked for in here. */
const ui = (page: Page) => page.getByTestId('panel');
const rows = (page: Page) => ui(page).getByTestId('result-row');
const breakdown = (page: Page) => ui(page).getByTestId('breakdown-row');

async function open(page: Page, stored: StoredRun, query = ''): Promise<void> {
  await page.goto(`/runs/${stored.run.id}${query}`);
  await expect(ui(page).getByTestId('panel-title')).toHaveText(stored.run.controlName);
}

test.describe('run results', () => {
  test('a run with violations shows the control in words, the summary, the breakdown and a reason for every record', async ({ page, api }, testInfo) => {
    const example = exampleNumber(4);
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN));
    await open(page, stored);

    await expect(ui(page).getByTestId('run-total')).toHaveText(String(example.expected.total));
    await expect(ui(page).getByTestId('run-sentence').getByTestId('mark')).toHaveText(
      letters.slice(0, stored.run.conditions!.length),
    );
    await expect(breakdown(page)).toHaveCount(stored.run.conditions!.length);
    await expect(rows(page)).toHaveCount(example.expected.total);

    // each record carries the marks of the conditions it matched, in order, and its actual values are marked
    const order = stored.run.conditions!.map((condition) => condition.id);
    for (const violation of example.expected.violations) {
      const row = ui(page).locator(`[data-testid="result-row"][data-key="${violation.key}"]`);
      await expect(row.getByTestId('reason').getByTestId('mark')).toHaveText(
        violation.matched.map((id) => letters[order.indexOf(id)]),
      );
    }
    const first = stored.results[0];
    const actual = first.reasons[0].textParts.find((part) => part.role === 'actual');
    if (actual) {
      await expect(rows(page).first().getByTestId('value').first()).toHaveText(actual.text);
    }
    await expect(ui(page).getByTestId('table-range')).toHaveText(
      t('results.range', { from: 1, to: example.expected.total, total: example.expected.total }),
    );
    await shot(page, testInfo, 'results-violations');
  });

  test('a breakdown row filters the records by its condition; the row says so, and the letters stay as they are', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN));
    await open(page, stored);
    const condition = stored.run.conditions!.find((entry) => entry.count! > 0 && entry.count! < stored.run.totalCount!)!;
    const row = ui(page).locator(`[data-testid="breakdown-row"][data-node="${condition.id}"]`);

    await row.click();

    await expect(page).toHaveURL(new RegExp(`condition=${condition.id}`));
    await expect(rows(page)).toHaveCount(condition.count!);
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(row.getByTestId('mark')).toHaveAttribute('data-state', 'resting');
    await expect(ui(page).getByTestId('run-sentence').locator(`[data-node="${condition.id}"]`).getByTestId('mark')).toHaveAttribute(
      'data-state',
      'resting',
    );

    await ui(page).getByTestId('breakdown-all').click();
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

    await ui(page).getByTestId('toolbar-search').fill(name);
    await expect(rows(page)).toHaveCount(expected.length);
    await expect(page).toHaveURL(/search=/);

    await ui(page).getByTestId('toolbar-search').fill('zzz-no-such-record');
    const panel = ui(page).getByTestId('no-match');
    await expect(panel).toContainText(t('results.noMatch.title', { term: 'zzz-no-such-record' }));
    await shot(page, testInfo, 'results-no-match');

    await panel.getByRole('button', { name: t('results.noMatch.clear'), exact: true }).click();
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    await expect(ui(page).getByTestId('toolbar-search')).toHaveValue('');
  });

  test('the records page, and the address keeps the page, its size and the order through a reload', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 23) }));
    await open(page, stored, '?size=10');

    await expect(rows(page)).toHaveCount(10);
    await expect(ui(page).getByTestId('table-range')).toHaveText(t('results.range', { from: 1, to: 10, total: 23 }));
    await expect(ui(page).getByTestId('page-previous')).toBeDisabled();

    await ui(page).getByTestId('page-next').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(ui(page).getByTestId('table-range')).toHaveText(t('results.range', { from: 11, to: 20, total: 23 }));
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results[10].key);

    await page.reload();
    await expect(ui(page).getByTestId('table-range')).toHaveText(t('results.range', { from: 11, to: 20, total: 23 }));
    await expect(rows(page).first()).toHaveAttribute('data-key', stored.results[10].key);

    await ui(page).getByTestId('page-next').click();
    await expect(rows(page)).toHaveCount(3);
    await expect(ui(page).getByTestId('page-next')).toBeDisabled();
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
    const head = ui(page).locator('th').first();

    await ui(page).getByTestId('sort-display').click();
    await expect(page).toHaveURL(/sort=display/);
    await expect(head).toHaveAttribute('aria-sort', 'ascending');
    await expect(firstCell()).toHaveText(sorted[0].split(' ')[0]);

    await ui(page).getByTestId('sort-display').click();
    await expect(page).toHaveURL(/dir=desc/);
    await expect(head).toHaveAttribute('aria-sort', 'descending');
    await expect(firstCell()).toHaveText(sorted.at(-1)!.split(' ')[0]);

    await ui(page).getByTestId('sort-display').click();
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
    await expect(ui(page).getByTestId('sort-display')).toBeHidden();

    await ui(page).getByTestId('toolbar-filters-toggle').click();
    await ui(page).getByTestId('sort-select').click();
    await page.getByRole('option', { name: t('results.sort.desc', { column }), exact: true }).click();

    await expect(page).toHaveURL(/sort=display&dir=desc|dir=desc&sort=display/);
  });

  test('the letters of the conditions are badges: the pointer and the keyboard change none of them', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    await open(page, stored);
    const id = stored.run.conditions![1].id;
    const marks = ui(page).getByTestId('mark');
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    const looks = () =>
      marks.evaluateAll((all) =>
        all.map((mark) => [mark.getAttribute('data-state'), getComputedStyle(mark).backgroundColor, getComputedStyle(mark).color].join(' ')),
      );
    const resting = await looks();
    expect(resting.length).toBeGreaterThan(4);
    expect(new Set(resting).size).toBe(1);

    for (const place of ['breakdown-row', 'reason', 'clause']) {
      await ui(page).locator(`[data-testid="${place}"][data-node="${id}"]`).first().hover();
      expect(await looks()).toEqual(resting);
    }
    await ui(page).locator(`[data-testid="breakdown-row"][data-node="${id}"]`).focus();
    expect(await looks()).toEqual(resting);
  });

  test('the picker lists the runs of the control, newest first, and choosing one shows that run', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 4);
    const all = exampleNumber(4).expected.violations;
    const older = api.addRun(succeededRun(control, RUN, { startedAt: '2026-11-08T07:12:00.000Z', expected: all.slice(0, 2) }));
    const stopped = api.addRun({ ...timedOutRun(control, RUN + 1), run: { ...timedOutRun(control, RUN + 1).run, startedAt: '2026-11-09T07:12:00.000Z' } });
    const newest = api.addRun(succeededRun(control, RUN + 2, { startedAt: '2026-11-10T07:12:00.000Z' }));
    // another control's run is not this control's history
    api.addRun(succeededRun(controlOf(api, 1), RUN + 3));
    await open(page, newest);
    const picker = ui(page).getByTestId('run-picker');

    await expect(picker).toContainText('10.11.2026');
    await expect(picker).toContainText(t('results.picker.found.other', { count: newest.run.totalCount! }));
    // the picker says when the run was; beside it stands only the version that ran
    await expect(ui(page).getByTestId('page-meta')).toHaveText(t('results.metaVersion', { version: newest.run.controlVersion }));
    await picker.click();
    const options = page.getByTestId('run-option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(1)).toContainText('09.11.2026');
    await expect(options.nth(1)).toContainText(t('results.picker.stopped'));
    // a list that is scanned counts in digits
    await expect(options.nth(2)).toContainText(t('results.picker.found.other', { count: 2 }));
    await shot(page, testInfo, 'results-picker');

    await options.nth(2).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${older.run.id}$`));
    await expect(ui(page).getByTestId('run-total')).toHaveText('2');
    await expect(rows(page)).toHaveCount(2);
    await expect(picker).toContainText('08.11.2026');

    // Esc with the picker open closes the picker, and the panel stays
    await picker.click();
    await expect(options).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
    await expect(ui(page)).toBeVisible();
    expect(stopped.run.status).toBe('timed_out');
  });

  test('a control with one run has no picker: the head says when it ran', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN, { startedAt: '2026-11-10T07:12:00.000Z' }));
    await open(page, stored);

    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    await expect(ui(page).getByTestId('run-picker')).toHaveCount(0);
    await expect(ui(page).getByTestId('page-meta')).toContainText('10.11.2026');
  });

  test('a control that never ran opens with its rule, its state and a run button, and the run shows its results', async ({ page, api }, testInfo) => {
    const example = exampleNumber(4);
    const control = controlOf(api, 4);
    await page.goto('/');
    await page.locator(`[data-testid="control-row"][data-id="${control.id}"]`).getByTestId('control-link').click();

    await expect(page).toHaveURL(new RegExp(`/controls/${control.id}/runs$`));
    await expect(ui(page).getByTestId('panel-title')).toHaveText(control.name);
    const state = ui(page).getByTestId('state-never-run');
    await expect(state).toContainText(t('results.never.title'));
    await expect(ui(page).getByTestId('run-sentence').getByTestId('mark').first()).toHaveText(letters[0]);
    await expect(ui(page).getByTestId('rerun')).toHaveCount(0);
    await expect(ui(page).getByTestId('edit-control')).toHaveAttribute('href', `/controls/${control.id}`);
    await shot(page, testInfo, 'results-never-run');

    await state.getByTestId('first-run').click();

    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(ui(page).getByTestId('run-total')).toHaveText(String(example.expected.total));
    await expect(rows(page)).toHaveCount(example.expected.total);
    // the address of the control with no run is not left in the history: Back leads to the list
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('panel')).toHaveCount(0);
  });

  test('the address of a control\'s results leads to its newest run, and says so for an archived control with none', async ({ page, api }) => {
    const control = controlOf(api, 4);
    api.addRun(succeededRun(control, RUN, { startedAt: '2026-11-08T07:12:00.000Z' }));
    api.addRun(succeededRun(control, RUN + 1, { startedAt: '2026-11-10T07:12:00.000Z' }));
    await page.goto(`/controls/${control.id}/runs`);
    await expect(page).toHaveURL(new RegExp(`/runs/${RUN + 1}$`));

    const archived = controlOf(api, 2);
    api.controls = api.controls.map((candidate) => (candidate.id === archived.id ? { ...candidate, isActive: false } : candidate));
    await page.goto(`/controls/${archived.id}/runs`);
    const state = ui(page).getByTestId('state-never-run');
    await expect(state).toContainText(t('results.never.bodyArchived'));
    await expect(state.getByTestId('first-run')).toHaveCount(0);
    await expect(ui(page).getByTestId('edit-control')).toHaveCount(0);

    await page.goto('/controls/987654/runs');
    await expect(ui(page).getByTestId('not-found')).toBeVisible();
  });

  test('the panel is the whole window on a phone, and leaves the list in view on a desk', async ({ page, api }, testInfo) => {
    const stored = api.addRun(succeededRun(controlOf(api, 4), RUN));
    await open(page, stored);

    const box = (await ui(page).boundingBox())!;
    // the window as the page is laid out in it: without the scrollbar, where the browser draws one
    const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: window.innerHeight }));
    // the panel floats with a little room around it; on a phone it has none and is the whole window
    const inset = await sheetInset(page);
    expect(box.height).toBe(viewport.height - 2 * inset);
    if (testInfo.project.name === 'mobile') {
      expect(inset).toBe(0);
      expect(box.width).toBe(viewport.width);
    } else {
      // the names of the list stay readable beside the panel, at the start edge
      expect(viewport.width - box.width).toBeGreaterThanOrEqual(300);
      expect(box.x).toBe(inset);
    }
    // nothing in the panel is wider than the panel
    const overflow = await ui(page).evaluate((panel) => [...panel.querySelectorAll('*')].filter((el) => el.scrollWidth > panel.clientWidth + 1).length);
    expect(overflow).toBe(0);
  });

  test('a run that found nothing says so, with what was checked', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: [] }));
    await open(page, stored);

    const panel = ui(page).getByTestId('state-no-violations');
    const entity = label(glossary.entities.find((candidate) => candidate.key === control.rootEntity)!.label.plural);
    await expect(panel).toContainText(t('results.none.title'));
    await expect(panel).toContainText(t('results.none.body', { entity }));
    // the panel stands in place of the breakdown and the table; the summary of the run stays
    await expect(ui(page).getByTestId('run-total')).toHaveText('0');
    await expect(ui(page).getByTestId('results-table')).toHaveCount(0);
    await expect(ui(page).getByTestId('breakdown')).toHaveCount(0);
    await shot(page, testInfo, 'results-no-violations');
  });

  test('the summary says how long the run took, and in words when it took next to nothing', async ({ page, api }) => {
    const control = controlOf(api, 4);
    const lasting = (id: number, durationMs: number): StoredRun => {
      const stored = succeededRun(control, id);
      return api.addRun({ ...stored, run: { ...stored.run, durationMs } });
    };
    const summary = ui(page).getByTestId('run-summary');
    const inWords = t('results.summary.durationUnder');

    // the real engine answers the sample data in a few milliseconds; 49 ms is the last that rounds to nothing
    for (const [id, durationMs] of [[RUN, 9], [RUN + 1, 49]]) {
      await open(page, lasting(id, durationMs));
      await expect(summary).toContainText(inWords);
      await expect(summary).not.toContainText(t('results.seconds.other', { count: '0' }));
    }
    for (const [id, durationMs, shown] of [[RUN + 2, 50, '0.1'], [RUN + 3, 412, '0.4']] as const) {
      await open(page, lasting(id, durationMs));
      await expect(summary).toContainText(t('results.seconds.other', { count: shown }));
      await expect(summary).not.toContainText(inWords);
    }
  });

  test('more violations than the cap: the exact total, how many are shown, and counts over all of them', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN, { expected: manyViolations(control, 20), totalAboveCap: 6412 }));
    await open(page, stored);

    await expect(ui(page).getByTestId('cap-banner')).toContainText(t('errors.ROW_CAP_EXCEEDED.title', { total: '6,412', stored: '20' }));
    await expect(ui(page).getByTestId('run-total')).toHaveText('6,412');
    await expect(breakdown(page).first().getByTestId('breakdown-count')).toHaveText('6,412');
    await expect(ui(page).getByTestId('table-range')).toHaveText(t('results.range', { from: 1, to: 20, total: 20 }));
    await shot(page, testInfo, 'results-cap');

    // the search reads the stored records only: when it finds none, the screen says how far it looked
    await ui(page).getByTestId('toolbar-search').fill('zzz-no-such-record');
    await expect(ui(page).getByTestId('no-match')).toContainText(
      t('results.noMatch.bodyCapped', { total: '6,412', stored: '20' }),
    );
  });

  test('a run that timed out says after how long it stopped and what to do', async ({ page, api }, testInfo) => {
    const stored = api.addRun(timedOutRun(controlOf(api, 1), RUN));
    await open(page, stored);

    const panel = ui(page).getByTestId('state-timed-out');
    await expect(panel).toContainText(t('errors.QUERY_TIMEOUT.title', { timeoutSeconds: 30 }));
    // the rule that was running is still read back, so "narrow the conditions" has something to point at
    await expect(ui(page).getByTestId('run-sentence').getByTestId('mark').first()).toHaveText(letters[0]);
    // the head offers the run again; the state does not repeat it
    await expect(ui(page).getByTestId('rerun')).toHaveCount(1);
    await expect(panel.getByRole('button')).toHaveCount(0);
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

    const panel = ui(page).getByTestId('state-outdated');
    await expect(panel).toContainText(t('errors.CONTROL_DEFINITION_OUTDATED.title'));
    await expect(panel).toContainText(t('results.outdated.one', { marks: letters[1] }));
    // the panel says the control cannot run: the head must not offer to run it
    await expect(ui(page).getByTestId('rerun')).toHaveCount(0);
    await expect(ui(page).getByTestId('edit-control')).toBeVisible();
    await shot(page, testInfo, 'results-outdated');
  });

  test('a run that failed for another reason offers to run again, and a run in progress to look again', async ({ page, api }, testInfo) => {
    const failed = api.addRun(failedRun(controlOf(api, 1), RUN, 'DATABASE_UNAVAILABLE'));
    await open(page, failed);
    // the run is in the past: the panel says what stopped it then, not that the data is unavailable now
    await expect(ui(page).getByTestId('state-failed')).toContainText(t('results.failed.reasons.DATABASE_UNAVAILABLE'));
    await expect(ui(page).getByTestId('rerun')).toBeVisible();
    await shot(page, testInfo, 'results-failed');

    const running = api.addRun(runningRun(controlOf(api, 2), RUN + 1));
    await open(page, running);
    await expect(ui(page).getByTestId('state-running')).toContainText(t('results.running.title'));
    // a run is on its way: the head offers no second one
    await expect(ui(page).getByTestId('rerun')).toHaveCount(0);
    await shot(page, testInfo, 'results-running');
  });

  test('a run that cannot be started again says why, and its "try again" tries the run again', async ({ page, api }) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN));
    api.fail(`POST /controls/${control.id}/runs`, problem(503, 'DATABASE_UNAVAILABLE'));
    await open(page, stored);
    await ui(page).getByTestId('rerun').click();
    const banner = ui(page).getByTestId('error-banner');
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

    await ui(page).getByTestId('rerun').focus();
    await page.keyboard.press('Enter');

    await expect(ui(page).getByTestId('rerun')).toBeDisabled();
    await expect(ui(page).getByTestId('rerun')).toContainText(t('results.actions.running'));
    await expect(ui(page).getByTestId('rerun')).toBeFocused();
    await expect(ui(page).getByTestId('skeleton-row').first()).toBeVisible();
    await shot(page, testInfo, 'results-rerunning');

    await expect(page).not.toHaveURL(new RegExp(`/runs/${RUN}$`));
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await expect(ui(page).getByTestId('previous-run')).toHaveAttribute('href', `/runs/${RUN}`);
  });

  test('the head and skeleton bars stand while a run is read, and an unknown run is not found', async ({ page, api }, testInfo) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    api.delay(`GET /runs/${RUN}`, 500);
    await page.goto(`/runs/${RUN}`);
    await expect(ui(page).getByTestId('results-loading')).toBeVisible();
    await shot(page, testInfo, 'results-loading');
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);

    await page.goto('/runs/987654');
    await expect(ui(page).getByTestId('not-found')).toBeVisible();
    await shot(page, testInfo, 'results-not-found');

    await page.goto('/runs/not-a-number');
    await expect(ui(page).getByTestId('not-found')).toBeVisible();
  });

  test('a glossary that cannot be read is said, and the stored results stay readable', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await open(page, stored);

    await expect(ui(page).getByTestId('error-banner')).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
    // without the glossary a record's number is still written digit for digit, never with a separator
    await expect(rows(page).first()).toContainText(stored.results[0].key);
    await expect(rows(page).first().getByTestId('reason').first()).toContainText(stored.results[0].reasons[0].text);
  });

  test('rows that cannot be read leave the failure in place of a table that would wait forever', async ({ page, api }) => {
    const stored = api.addRun(succeededRun(controlOf(api, 1), RUN));
    api.fail(`GET /runs/${RUN}/results`, problem(400, 'REQUEST_INVALID'));
    await open(page, stored);

    await expect(ui(page).getByTestId('error-banner')).toHaveAttribute('data-code', 'REQUEST_INVALID');
    await expect(ui(page).getByTestId('skeleton-row')).toHaveCount(0);
    await expect(ui(page).getByTestId('results-table')).toHaveAttribute('aria-busy', 'false');
  });

  test('a run of an archived control cannot be run again, and the screen says why', async ({ page, api }) => {
    const control = controlOf(api, 1);
    const stored = api.addRun(succeededRun(control, RUN));
    api.fail(`POST /controls/${control.id}/runs`, problem(409, 'CONTROL_ARCHIVED', { id: control.id }));
    await open(page, stored);

    await ui(page).getByTestId('rerun').click();

    await expect(ui(page).getByTestId('archived-banner')).toContainText(t('errors.CONTROL_ARCHIVED.title'));
    await expect(ui(page).getByTestId('error-banner')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(stored.run.totalCount!);
  });
});
