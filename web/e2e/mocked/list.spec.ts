import { Page } from '@playwright/test';

import { Control } from '../../src/app/core/api/api.types';
import { exampleNumber, examples } from '../fixtures/examples';
import { glossary, label } from '../fixtures/glossary';
import { succeededRun, timedOutRun } from '../fixtures/runs';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { FakeApi, problem } from '../support/routes';
import { shot } from '../support/shots';

const rows = (page: Page) => page.getByTestId('control-row');
const tabCount = (page: Page, tab: 'active' | 'archived') => page.getByTestId(`tab-${tab}`).getByTestId('tab-count');
const rowOf = (page: Page, control: Control) => page.locator(`[data-testid="control-row"][data-id="${control.id}"]`);

function controlOf(api: FakeApi, number: 1 | 2 | 3 | 4 | 5 | 6): Control {
  const wanted = JSON.stringify(exampleNumber(number).definition);
  return api.controls.find((control) => JSON.stringify(control.definition) === wanted)!;
}

/** The place of a control among the active ones, in the order of the list (by name). */
function indexOf(api: FakeApi, control: Control): number {
  const active = api.controls
    .filter((candidate) => candidate.isActive || candidate.id === control.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'he') || a.id - b.id);
  const index = active.findIndex((candidate) => candidate.id === control.id);
  return Math.min(index, active.length - 2);
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.getByTestId('page-title')).toHaveText(t('list.title'));
}

test.describe('controls list', () => {
  test('the delivered system opens on its example controls, none of them run yet', async ({ page, api }, testInfo) => {
    await open(page);

    await expect(rows(page)).toHaveCount(examples.length);
    expect(examples.length).toBeGreaterThan(2);
    // the two tabs say how many controls each holds; the active one is the one shown
    await expect(page.getByTestId('tab-active')).toHaveAttribute('aria-selected', 'true');
    await expect(tabCount(page, 'active')).toHaveText(String(examples.length));
    await expect(tabCount(page, 'archived')).toHaveText('0');
    const byName = [...api.controls].sort((a, b) => a.name.localeCompare(b.name, 'he') || a.id - b.id);
    await expect(rows(page).getByTestId('control-link')).toHaveText(byName.map((control) => control.name));
    await expect(rows(page).getByTestId('last-run')).toHaveText(byName.map(() => t('list.neverRun')));
    for (const row of await rows(page).all()) {
      await expect(row.getByTestId('result')).toHaveAttribute('data-result', 'never');
    }
    await expect(page.getByTestId('first-use')).toHaveCount(0);
    await shot(page, testInfo, 'list-delivered');
  });

  test('a run from the list stays on the list and puts its result on the row', async ({ page, api }) => {
    const example = exampleNumber(1);
    const control = controlOf(api, 1);
    api.delay(`POST /controls/${control.id}/runs`, 500);
    await open(page);
    const row = rowOf(page, control);

    const announced = page.getByTestId('run-announcement');
    await row.getByTestId('run').focus();
    await page.keyboard.press('Enter');
    await expect(row.getByTestId('run')).toBeDisabled();
    await expect(row.getByTestId('run')).toContainText(t('list.actions.running'));
    // the row changes in place: the button keeps the focus, and the start and the outcome are said aloud
    await expect(row.getByTestId('run')).toBeFocused();
    await expect(announced).toHaveText(t('list.announce.started', { name: control.name }));

    const link = row.getByTestId('result').getByRole('link');
    expect(example.expected.total).toBeGreaterThan(2);
    await expect(link).toHaveText(t('results.violations.other', { count: example.expected.total }));
    await expect(row.getByTestId('last-run')).toContainText(t('common.todayAt', { time: '' }).trim());
    await expect(page).toHaveURL(/\/$/);
    await expect(row.getByTestId('run')).toBeEnabled();
    await expect(row.getByTestId('run')).toBeFocused();
    await expect(announced).toHaveText(
      t('list.announce.finished', {
        name: control.name,
        result: t('results.violations.other', { count: example.expected.total }),
      }),
    );

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/runs/${api.runs.at(-1)!.run.id}$`));
  });

  test('a row says what its last run found: violations, none, or that it stopped', async ({ page, api }, testInfo) => {
    const [found, clean, stopped] = [controlOf(api, 4), controlOf(api, 2), controlOf(api, 6)];
    api.addRun(succeededRun(found, 501));
    api.addRun(succeededRun(clean, 502, { expected: [] }));
    api.addRun(timedOutRun(stopped, 503));
    await open(page);

    await expect(rowOf(page, found).getByTestId('result').getByRole('link')).toHaveAttribute('href', '/runs/501');
    await expect(rowOf(page, clean).getByTestId('result').getByRole('link')).toHaveText(t('list.result.none'));
    await expect(rowOf(page, clean).getByTestId('result').getByRole('link')).toHaveAttribute('href', '/runs/502');
    await expect(rowOf(page, stopped).getByTestId('result').getByRole('link')).toHaveText(t('list.result.stopped'));
    await expect(rowOf(page, stopped).getByTestId('result').getByRole('link')).toHaveAttribute('href', '/runs/503');
    await shot(page, testInfo, 'list-results');
  });

  test('the search narrows the list by name, and says so when nothing matches', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 3);
    await open(page);

    await page.getByTestId('toolbar-search').fill(control.name);
    await expect(rows(page)).toHaveCount(1);
    await expect(rowOf(page, control)).toBeVisible();
    await expect(page).toHaveURL(/search=/);
    // narrowed, each tab says how many of what was searched for it holds
    await expect(tabCount(page, 'active')).toHaveText('1');
    await expect(tabCount(page, 'archived')).toHaveText('0');

    await page.getByTestId('toolbar-search').fill('zzz-no-such-control');
    const panel = page.getByTestId('no-match');
    await expect(panel).toContainText(t('list.noMatch.title', { term: 'zzz-no-such-control' }));
    await shot(page, testInfo, 'list-no-match');

    await panel.getByRole('button', { name: t('list.noMatch.clear'), exact: true }).click();
    await expect(rows(page)).toHaveCount(examples.length);
  });

  test('the filter narrows the list by what is checked, and the archive tab holds the archived controls, to duplicate only', async ({ page, api }, testInfo) => {
    const archived = controlOf(api, 2);
    api.controls = api.controls.map((control) => (control.id === archived.id ? { ...control, isActive: false } : control));
    const entity = glossary.entities.find((candidate) => candidate.key === controlOf(api, 5).rootEntity)!;
    const ofEntity = api.controls.filter((control) => control.rootEntity === entity.key && control.isActive);
    await open(page);
    await expect(rows(page)).toHaveCount(examples.length - 1);
    await expect(tabCount(page, 'active')).toHaveText(String(examples.length - 1));
    await expect(tabCount(page, 'archived')).toHaveText('1');

    if (testInfo.project.name === 'mobile') {
      await page.getByTestId('toolbar-filters-toggle').click();
    }
    await page.getByTestId('filter-entity').click();
    await page.getByRole('option', { name: label(entity.label.plural), exact: true }).click();
    await expect(rows(page)).toHaveCount(ofEntity.length);
    await expect(page).toHaveURL(new RegExp(`entity=${entity.key}`));
    await expect(tabCount(page, 'active')).toHaveText(String(ofEntity.length));

    await page.goto('/');
    await page.getByTestId('tab-archived').click();
    await expect(page).toHaveURL(/state=archived/);
    await expect(page.getByTestId('tab-archived')).toHaveAttribute('aria-selected', 'true');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByTestId('archive-note')).toHaveText(t('list.archiveNote'));
    const row = rowOf(page, archived);
    await expect(row.getByTestId('run')).toHaveCount(0);
    await expect(row.getByTestId('edit')).toHaveCount(0);
    await expect(row.getByTestId('archive')).toHaveCount(0);
    await expect(row.getByTestId('duplicate')).toBeVisible();
    await shot(page, testInfo, 'list-archived');

    // the tabs are one stop of the keyboard: an arrow moves to the other tab and shows it
    await page.getByTestId('tab-archived').press('ArrowRight');
    await expect(page.getByTestId('tab-active')).toBeFocused();
    await expect(page).not.toHaveURL(/state=/);
    await expect(rows(page)).toHaveCount(examples.length - 1);
  });

  test('a control is archived from its row, after a word of what that means, and moves to the archive with its runs', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 4);
    api.addRun(succeededRun(control, 501));
    await open(page);
    const row = rowOf(page, control);

    await row.getByTestId('archive').click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText(t('list.archive.title'));
    await expect(dialog).toContainText(t('list.archive.body', { name: control.name }));
    await shot(page, testInfo, 'list-archive-confirm');
    // closed without a yes, nothing happened
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
    expect(api.callsTo(`DELETE /controls/${control.id}`)).toHaveLength(0);

    await row.getByTestId('archive').click();
    await page.getByTestId('confirm-accept').click();

    await expect(row).toHaveCount(0);
    await expect(page.getByText(t('list.toast.archived'), { exact: true })).toBeVisible();
    await expect(tabCount(page, 'active')).toHaveText(String(examples.length - 1));
    await expect(tabCount(page, 'archived')).toHaveText('1');
    // the row and its button are gone: the keyboard goes on from the row that took its place
    await expect(rows(page).getByTestId('control-link').nth(indexOf(api, control))).toBeFocused();

    // only the control is archived: its run is kept, and its name still opens it
    await page.getByTestId('tab-archived').click();
    await expect(rowOf(page, control).getByTestId('result').getByRole('link')).toHaveAttribute('href', '/runs/501');
    await expect(rowOf(page, control).getByTestId('control-link')).toHaveAttribute('href', '/runs/501');
  });

  test('a control that cannot be archived says why, and stays on the list', async ({ page, api }) => {
    const control = controlOf(api, 1);
    api.fail(`DELETE /controls/${control.id}`, problem(503, 'DATABASE_UNAVAILABLE'));
    await open(page);

    await rowOf(page, control).getByTestId('archive').click();
    await page.getByTestId('confirm-accept').click();

    await expect(page.getByTestId('error-banner')).toHaveAttribute('data-code', 'DATABASE_UNAVAILABLE');
    await expect(rowOf(page, control)).toBeVisible();
  });

  test('the pencil of a row leads to the editor of its control, and the copy button to a copy of it', async ({ page, api }) => {
    const control = controlOf(api, 1);
    await open(page);

    await rowOf(page, control).getByTestId('edit').click();
    await expect(page).toHaveURL(new RegExp(`/controls/${control.id}$`));
    await expect(page.getByTestId('panel').getByTestId('control-name')).toHaveValue(control.name);

    // the browser's back closes the panel as its X does
    await page.goBack();
    await expect(page.getByTestId('panel')).toHaveCount(0);
    await rowOf(page, control).getByTestId('duplicate').click();
    await expect(page).toHaveURL(new RegExp(`/controls/new\\?from=${control.id}$`));
    await expect(page.getByTestId('control-name')).toHaveValue(t('editor.copyName', { name: control.name }));
  });

  test('the name of a control opens the results of its last run in a panel over the list, and the list takes the focus back', async ({ page, api }, testInfo) => {
    const control = controlOf(api, 4);
    api.addRun(succeededRun(control, 501));
    await open(page);
    const name = rowOf(page, control).getByTestId('control-link');
    const panel = page.getByTestId('panel');

    // the X
    await name.click();
    await expect(page).toHaveURL(/\/runs\/501$/);
    await expect(panel.getByTestId('panel-title')).toHaveText(control.name);
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    // the list is still there behind the panel, out of reach, and the keyboard starts from the panel
    await expect(rows(page)).toHaveCount(examples.length);
    await expect(page.getByTestId('listing')).toHaveAttribute('inert', '');
    await expect(panel).toBeFocused();
    await shot(page, testInfo, 'list-panel');
    await page.getByTestId('panel-close').click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(name).toBeFocused();

    // Esc
    await name.press('Enter');
    await expect(panel.getByTestId('panel-title')).toHaveText(control.name);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(name).toBeFocused();

    // a click beside the panel, where the list shows (the panel is the whole window on a phone)
    if (testInfo.project.name === 'desktop') {
      await name.click();
      await expect(panel).toBeVisible();
      await page.getByTestId('panel-scrim').click({ position: { x: 1400, y: 450 } });
      await expect(panel).toHaveCount(0);
      await expect(name).toBeFocused();
    }
  });

  test('the list keeps its search, its tab and its page under a panel, and has them back when the panel closes', async ({ page, api }) => {
    const base = api.controls[0];
    // thirty archived controls of one name: the archive tab, searched, on its second page
    api.controls = Array.from({ length: 30 }, (_, index) => ({
      ...base,
      id: 100 + index,
      isActive: false,
      name: `${base.name} ${String(index).padStart(2, '0')}`,
    }));
    await open(page, `?state=archived&search=${encodeURIComponent(base.name)}&page=2`);
    await expect(page.getByTestId('tab-archived')).toHaveAttribute('aria-selected', 'true');
    await expect(rows(page)).toHaveCount(5);
    const first = rows(page).first();
    const id = await first.getAttribute('data-id');

    await first.getByTestId('control-link').click();
    await expect(page).toHaveURL(new RegExp(`/controls/${id}/runs$`));
    // the panel's address says nothing of the list: the list behind it is still the tab that was searched
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByTestId('tab-archived')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('listing').getByTestId('toolbar-search')).toHaveValue(base.name);
    // opening a panel reads nothing of the list again: it changed nothing
    const reads = api.callsTo('GET /controls').length;
    await expect(page.getByTestId('panel').getByTestId('state-never-run')).toBeVisible();
    expect(api.callsTo('GET /controls')).toHaveLength(reads);

    await page.getByTestId('panel-close').click();
    await expect(page).toHaveURL(/state=archived/);
    await expect(page).toHaveURL(/search=/);
    await expect(page).toHaveURL(/page=2/);
    await expect(rows(page)).toHaveCount(5);
    await expect(first.getByTestId('control-link')).toBeFocused();
  });

  test('a list with no control at all explains what a control is and offers the two ways to start', async ({ page, api }, testInfo) => {
    api.controls = [];
    await open(page);

    const panel = page.getByTestId('first-use');
    await expect(panel).toContainText(t('list.first.title'));
    await expect(panel.getByRole('link', { name: t('list.actions.new') })).toHaveAttribute('href', '/controls/new');
    await expect(panel.getByRole('button', { name: t('list.actions.suggestions') })).toBeVisible();
    await expect(page.getByTestId('controls-table')).toHaveCount(0);
    // one filled button in the view: the panel carries the actions, the head leaves them to it
    await expect(page.getByRole('link', { name: t('list.actions.new') })).toHaveCount(1);
    await shot(page, testInfo, 'list-first-use');
  });

  test('a list whose controls are all archived says so and leads to them, and is no first use', async ({ page, api }) => {
    api.controls = api.controls.map((control) => ({ ...control, isActive: false }));
    await open(page);

    const panel = page.getByTestId('no-active');
    await expect(panel).toContainText(t('list.noActive.title'));
    await expect(page.getByTestId('first-use')).toHaveCount(0);
    await expect(page.getByTestId('toolbar-search')).toBeVisible();

    await panel.getByRole('button', { name: t('list.noActive.show'), exact: true }).click();
    await expect(page).toHaveURL(/state=archived/);
    await expect(rows(page)).toHaveCount(examples.length);
  });

  test('a glossary that cannot be read is said, and the list stays readable', async ({ page, api }) => {
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await open(page);

    await expect(page.getByTestId('error-banner')).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(rows(page)).toHaveCount(examples.length);
  });

  test('a long list pages, and the address keeps the page', async ({ page, api }) => {
    const base = api.controls[0];
    api.controls = Array.from({ length: 30 }, (_, index) => ({ ...base, id: 100 + index, name: `${base.name} ${String(index).padStart(2, '0')}` }));
    await open(page);

    await expect(rows(page)).toHaveCount(25);
    await expect(page.getByTestId('table-range')).toHaveText(t('list.range', { from: 1, to: 25, total: 30 }));

    await page.getByTestId('page-next').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows(page)).toHaveCount(5);

    await page.reload();
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByTestId('page-next')).toBeDisabled();
  });

  test('the head and the toolbar stand while the list is read, over skeleton rows', async ({ page, api }) => {
    api.delay('GET /controls', 600);
    await page.goto('/');

    await expect(page.getByTestId('page-title')).toHaveText(t('list.title'));
    await expect(page.getByTestId('toolbar-search')).toBeVisible();
    await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
    await expect(rows(page)).toHaveCount(examples.length);
  });

  test('a list that cannot be read offers to try again, and a run that cannot be started says why', async ({ page, api }) => {
    api.fail('GET /controls', problem(503, 'DATABASE_UNAVAILABLE'));
    await page.goto('/');
    const banner = page.getByTestId('error-banner');
    await expect(banner).toHaveAttribute('data-code', 'DATABASE_UNAVAILABLE');

    api.heal('GET /controls');
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();
    await expect(rows(page)).toHaveCount(examples.length);
    await expect(banner).toHaveCount(0);

    // an engine that fails is a failed run (201); the request itself fails when the api cannot write the run
    const control = controlOf(api, 1);
    api.fail(`POST /controls/${control.id}/runs`, problem(503, 'DATABASE_UNAVAILABLE'));
    await rowOf(page, control).getByTestId('run').click();
    await expect(banner).toHaveAttribute('data-code', 'DATABASE_UNAVAILABLE');
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(rowOf(page, control).getByTestId('run')).toBeEnabled();
    await expect(rowOf(page, control).getByTestId('result')).toHaveAttribute('data-result', 'never');
  });
});
