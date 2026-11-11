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
const rowOf = (page: Page, control: Control) => page.locator(`[data-testid="control-row"][data-id="${control.id}"]`);

function controlOf(api: FakeApi, number: 1 | 2 | 3 | 4 | 5 | 6): Control {
  const wanted = JSON.stringify(exampleNumber(number).definition);
  return api.controls.find((control) => JSON.stringify(control.definition) === wanted)!;
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
    await expect(page.getByTestId('page-meta')).toHaveText(t('list.count.active.other', { count: examples.length }));
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

    await row.getByTestId('run').click();
    await expect(row.getByTestId('run')).toBeDisabled();
    await expect(row.getByTestId('run')).toContainText(t('list.actions.running'));

    const link = row.getByTestId('result').getByRole('link');
    expect(example.expected.total).toBeGreaterThan(2);
    await expect(link).toHaveText(t('results.violations.other', { count: example.expected.total }));
    await expect(row.getByTestId('last-run')).toContainText(t('common.todayAt', { time: '' }).trim());
    await expect(page).toHaveURL(/\/$/);
    await expect(row.getByTestId('run')).toBeEnabled();

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
    await expect(rowOf(page, clean).getByTestId('result')).toHaveText(t('list.result.none'));
    await expect(rowOf(page, clean).getByTestId('result').getByRole('link')).toHaveCount(0);
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

    await page.getByTestId('toolbar-search').fill('zzz-no-such-control');
    const panel = page.getByTestId('no-match');
    await expect(panel).toContainText(t('list.noMatch.title', { term: 'zzz-no-such-control' }));
    await shot(page, testInfo, 'list-no-match');

    await panel.getByRole('button', { name: t('list.noMatch.clear'), exact: true }).click();
    await expect(rows(page)).toHaveCount(examples.length);
  });

  test('the filters narrow the list by root entity and by state, and archived controls offer only duplicate', async ({ page, api }, testInfo) => {
    const archived = controlOf(api, 2);
    api.controls = api.controls.map((control) => (control.id === archived.id ? { ...control, isActive: false } : control));
    const entity = glossary.entities.find((candidate) => candidate.key === controlOf(api, 5).rootEntity)!;
    const ofEntity = api.controls.filter((control) => control.rootEntity === entity.key && control.isActive);
    await open(page);
    const filters = async () => {
      if (testInfo.project.name === 'mobile') {
        await page.getByTestId('toolbar-filters-toggle').click();
      }
    };
    await expect(rows(page)).toHaveCount(examples.length - 1);

    await filters();
    await page.getByTestId('filter-entity').click();
    await page.getByRole('option', { name: label(entity.label.plural), exact: true }).click();
    await expect(rows(page)).toHaveCount(ofEntity.length);
    await expect(page).toHaveURL(new RegExp(`entity=${entity.key}`));

    await page.goto('/');
    await filters();
    await page.getByTestId('filter-state').click();
    await page.getByRole('option', { name: t('list.states.archived'), exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    const row = rowOf(page, archived);
    await expect(row.getByTestId('archived-chip')).toHaveText(t('list.archived'));
    await expect(row.getByTestId('run')).toHaveCount(0);
    await expect(row.getByTestId('duplicate')).toBeVisible();
    await expect(page.getByTestId('page-meta')).toHaveText(t('list.count.archived.one'));
    await shot(page, testInfo, 'list-archived');

    await page.getByTestId('filter-state').click();
    await page.getByRole('option', { name: t('list.states.all'), exact: true }).click();
    await expect(rows(page)).toHaveCount(examples.length);
  });

  test('a row leads to the editor of its control and to a copy of it', async ({ page, api }) => {
    const control = controlOf(api, 1);
    await open(page);

    await rowOf(page, control).getByTestId('edit').click();
    await expect(page).toHaveURL(new RegExp(`/controls/${control.id}$`));

    await page.goBack();
    await rowOf(page, control).getByTestId('duplicate').click();
    await expect(page).toHaveURL(new RegExp(`/controls/new\\?from=${control.id}$`));
    await expect(page.getByTestId('control-name')).toHaveValue(t('editor.copyName', { name: control.name }));
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
