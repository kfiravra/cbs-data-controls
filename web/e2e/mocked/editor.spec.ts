import { Page } from '@playwright/test';

import { Control } from '../../src/app/core/api/api.types';
import { ConditionNode } from '../../src/app/core/definition/definition.types';
import { exampleNumber } from '../fixtures/examples';
import { glossary, label } from '../fixtures/glossary';
import { engine } from '../fixtures/runs';
import { BuilderDriver } from '../support/builder-driver';
import { normalized } from '../support/definitions';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { FakeApi, problem } from '../support/routes';
import { shot } from '../support/shots';

const letters = t('common.markLetters').split(' ');

/** The stored control of example 1: two conditions, both with a typed number. */
function stored(api: FakeApi): Control {
  const example = exampleNumber(1);
  return api.controls.find((control) => JSON.stringify(control.definition) === JSON.stringify(example.definition))!;
}

async function openStored(page: Page, control: Control): Promise<void> {
  await page.goto(`/controls/${control.id}`);
  await expect(page.getByTestId('control-name')).toHaveValue(control.name);
  await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length);
}

const sentence = (page: Page) => page.getByTestId('sentence');
const row = (page: Page, index: number) => page.getByTestId('condition-row').nth(index);

test.describe('control editor', () => {
  test('a new control is built, read back as the engine sentence with a mark per clause, and saved', async ({ page, api }, testInfo) => {
    const example = exampleNumber(1);
    await page.goto('/controls/new');
    await expect(page.getByTestId('sentence-hint')).toHaveText(t('editor.sentence.hint'));

    await page.getByTestId('control-name').fill(example.name['he']);
    await new BuilderDriver(page).build(example.definition);

    const rendered = engine.sentenceOf(example.definition);
    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');
    await expect(sentence(page).getByTestId('mark')).toHaveText(letters.slice(0, rendered.conditions.length));
    await expect(sentence(page)).toContainText(rendered.conditions[1].sentence.split(' ').slice(1).join(' '));
    await expect(page.getByTestId('sentence-status')).toHaveCount(0);
    await shot(page, testInfo, 'editor-new');

    await page.getByTestId('save').click();

    await expect(page.getByText(t('editor.toast.saved'), { exact: true })).toBeVisible();
    const [created] = api.callsTo('POST /controls');
    expect(created.body).toMatchObject({ name: example.name['he'], description: null });
    expect(normalized((created.body as Control).definition)).toEqual(normalized(example.definition));
    await expect(page).toHaveURL(new RegExp(`/controls/${api.controls.at(-1)!.id}$`));
    await expect(page.getByTestId('archive')).toBeVisible();
  });

  test('a stored control opens with its details, its tree and its sentence', async ({ page, api }, testInfo) => {
    const control = stored(api);
    await openStored(page, control);

    await expect(page.getByTestId('control-description')).toHaveValue(control.description!);
    await expect(page.getByTestId('page-meta')).toContainText(String(control.version));
    await expect(sentence(page).getByTestId('mark')).toHaveText(letters.slice(0, 2));
    for (const [index, child] of control.definition.where.children.entries()) {
      const field = glossary.entities
        .find((entity) => entity.key === control.rootEntity)!
        .fields.find((candidate) => candidate.key === (child as ConditionNode).left.field)!;
      await expect(row(page, index).getByTestId('field-picker')).toContainText(label(field.label));
      await expect(row(page, index).getByTestId('value-single')).toHaveValue(String((child as ConditionNode).value));
    }
    await shot(page, testInfo, 'editor-existing');
  });

  test('a name-only save keeps the version, and a changed condition is saved as a new version', async ({ page, api }) => {
    const control = stored(api);
    await openStored(page, control);

    await page.getByTestId('control-name').fill(`${control.name} 2`);
    await page.getByTestId('save').click();
    await expect(page.getByText(t('editor.toast.saved'), { exact: true })).toBeVisible();
    expect(api.controls.find((candidate) => candidate.id === control.id)!.version).toBe(1);

    await row(page, 0).getByTestId('value-single').fill('17');
    await page.getByTestId('save').click();
    await expect(page.getByText(t('editor.toast.savedVersion', { version: 2 }), { exact: true })).toBeVisible();
    await expect(page.getByTestId('page-meta')).toContainText('2');
  });

  test('an unfinished condition dims the sentence, is named by the status line, and blocks the save with its reason', async ({ page, api }, testInfo) => {
    const control = stored(api);
    await openStored(page, control);
    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');

    await row(page, 1).getByTestId('value-single').fill('');

    await expect(sentence(page)).toHaveAttribute('data-stale', 'true');
    await expect(page.getByTestId('sentence-status')).toHaveText(
      t('editor.status.incomplete', { mark: letters[1], reason: t('editor.issueWhat.missingValue') }),
    );
    await expect(sentence(page).getByTestId('mark').nth(1)).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('row-error')).toHaveCount(0);

    await page.getByTestId('save').click();

    await expect(row(page, 1).getByTestId('row-error')).toHaveText(t('editor.issues.missingValue'));
    await expect(row(page, 1).getByTestId('value-single')).toBeFocused();
    await expect(row(page, 1).getByTestId('value-single')).toHaveAttribute('aria-invalid', 'true');
    await expect(row(page, 0).getByTestId('value-single')).toHaveAttribute('aria-invalid', 'false');
    expect(api.callsTo(`PUT /controls/${control.id}`)).toHaveLength(0);
    await shot(page, testInfo, 'editor-incomplete');
  });

  test('a save without a name asks for the name and sends nothing', async ({ page, api }) => {
    await page.goto('/controls/new');
    await new BuilderDriver(page).build(exampleNumber(2).definition);

    await page.getByTestId('save').click();

    await expect(page.getByTestId('name-error')).toHaveText(t('editor.details.name.required'));
    await expect(page.getByTestId('control-name')).toBeFocused();
    expect(api.callsTo('POST /controls')).toHaveLength(0);
  });

  test('an error of a refused save stands on the row it names', async ({ page, api }, testInfo) => {
    const control = stored(api);
    const second = control.definition.where.children[1] as ConditionNode;
    api.fail(
      `PUT /controls/${control.id}`,
      problem(422, 'DEFINITION_INVALID', {}, [
        { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/1/value', nodeId: second.id, params: {} },
      ]),
    );
    await openStored(page, control);

    await row(page, 1).getByTestId('value-single').fill('16000');
    await page.getByTestId('save').click();

    await expect(row(page, 1).getByTestId('row-error')).toHaveText(t('errors.definition.VALUE_TYPE_MISMATCH'));
    await expect(row(page, 0).getByTestId('row-error')).toHaveCount(0);
    await expect(row(page, 1).getByTestId('mark')).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('error-banner')).toHaveCount(0);
    await shot(page, testInfo, 'editor-row-error');
  });

  test('a save that lost to another save says so and loads the current version on request', async ({ page, api }, testInfo) => {
    const control = stored(api);
    await openStored(page, control);
    // someone else saved meanwhile: the stored control moved on
    api.controls = api.controls.map((candidate) =>
      candidate.id === control.id ? { ...candidate, name: `${control.name} B`, concurrencyToken: 'moved-on' } : candidate,
    );

    await page.getByTestId('control-name').fill(`${control.name} A`);
    await page.getByTestId('save').click();

    const banner = page.getByTestId('conflict-banner');
    await expect(banner).toContainText(t('errors.CONCURRENCY_CONFLICT.title'));
    await shot(page, testInfo, 'editor-conflict');

    await banner.getByRole('button', { name: t('editor.actions.loadCurrent'), exact: true }).click();
    await expect(page.getByTestId('control-name')).toHaveValue(`${control.name} B`);
    await expect(banner).toHaveCount(0);
  });

  test('a stored control the glossary no longer fits says so at once, on the row that is outdated', async ({ page, api }, testInfo) => {
    const control = stored(api);
    const first = control.definition.where.children[0] as ConditionNode;
    const outdated = {
      ...control.definition,
      where: {
        ...control.definition.where,
        children: [{ ...first, left: { field: 'a_field_that_is_gone' } }, ...control.definition.where.children.slice(1)],
      },
    };
    api.controls = api.controls.map((candidate) => (candidate.id === control.id ? { ...candidate, definition: outdated } : candidate));
    api.answerValidate(
      outdated,
      problem(422, 'DEFINITION_INVALID', {}, [
        { code: 'UNKNOWN_FIELD', path: '/where/children/0/left', nodeId: first.id, params: { entity: 'e', field: 'f' } },
      ]),
    );

    await page.goto(`/controls/${control.id}`);

    await expect(page.getByTestId('outdated-banner')).toContainText(t('errors.CONTROL_DEFINITION_OUTDATED.title'));
    await expect(row(page, 0).getByTestId('row-error')).toHaveText(t('errors.definition.UNKNOWN_FIELD'));
    await expect(row(page, 0).getByTestId('field-picker')).toContainText(t('editor.field.gone'));
    await expect(page.getByText('a_field_that_is_gone')).toHaveCount(0);
    await shot(page, testInfo, 'editor-outdated');
  });

  test('an engine that does not answer leaves the screen in place and offers to try again', async ({ page, api }, testInfo) => {
    const control = stored(api);
    api.fail('POST /controls/validate', problem(503, 'ENGINE_UNAVAILABLE'));
    await openStored(page, control);

    const banner = page.getByTestId('error-banner');
    await expect(banner).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(banner).toContainText(t('errors.ENGINE_UNAVAILABLE.title'));
    await expect(page.getByTestId('sentence-hint')).toBeVisible();
    await shot(page, testInfo, 'editor-engine-down');

    api.heal('POST /controls/validate');
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');
    await expect(banner).toHaveCount(0);
  });

  test('a glossary that cannot be read is said under the page head, and read again on request', async ({ page, api }) => {
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await page.goto('/controls/new');

    const banner = page.getByTestId('error-banner');
    await expect(banner).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(page.getByTestId('control-name')).toBeVisible();

    api.heal('GET /glossary');
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(page.getByTestId('condition-row')).toHaveCount(1);
    await expect(banner).toHaveCount(0);
  });

  test('a stored control whose glossary could not be read is built once the glossary is read again', async ({ page, api }) => {
    const control = stored(api);
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await page.goto(`/controls/${control.id}`);
    await expect(page.getByTestId('control-name')).toHaveValue(control.name);
    await expect(page.getByTestId('condition-builder')).toHaveCount(0);

    api.heal('GET /glossary');
    await page.getByTestId('error-banner').getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length);
    await expect(page.getByTestId('error-banner')).toHaveCount(0);
    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');
  });

  test('removing a row the server refused takes its error and its status line away', async ({ page, api }) => {
    const control = stored(api);
    const second = control.definition.where.children[1] as ConditionNode;
    api.fail(
      `PUT /controls/${control.id}`,
      problem(422, 'DEFINITION_INVALID', {}, [
        { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/1/value', nodeId: second.id, params: {} },
      ]),
    );
    await openStored(page, control);
    await page.getByTestId('control-name').fill(`${control.name} 2`);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('row-error')).toHaveCount(1);

    await row(page, 1).getByTestId('remove-row').click();

    await expect(page.getByTestId('row-error')).toHaveCount(0);
    await expect(page.getByTestId('sentence-status')).toHaveCount(0);
  });

  test('a first save and run leaves the saved control, not the unsaved one, behind in the history', async ({ page, api }) => {
    const source = stored(api);
    await page.goto(`/controls/new?from=${source.id}`);
    await expect(page.getByTestId('condition-row')).toHaveCount(source.definition.where.children.length);

    await page.getByTestId('save-run').click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await page.goBack();

    const created = api.controls.at(-1)!;
    await expect(page).toHaveURL(new RegExp(`/controls/${created.id}$`));
    await expect(page.getByTestId('control-name')).toHaveValue(created.name);
    expect(api.callsTo('POST /controls')).toHaveLength(1);
  });

  test('save and run goes to the results of the new run', async ({ page, api }) => {
    const control = stored(api);
    await openStored(page, control);

    await page.getByTestId('save-run').click();

    await expect(page).toHaveURL(/\/runs\/\d+$/);
    expect(api.callsTo(`POST /controls/${control.id}/runs`)).toHaveLength(1);
  });

  test('another root entity starts the conditions over, and the toast brings them back', async ({ page, api }) => {
    const control = stored(api);
    await openStored(page, control);
    const other = glossary.entities.find((entity) => entity.rootable && entity.key !== control.rootEntity)!;

    await page.getByRole('radio', { name: label(other.label.plural) }).click();
    await expect(page.getByTestId('condition-row')).toHaveCount(1);
    await expect(row(page, 0).getByTestId('value-single')).toHaveCount(0);

    await page.getByRole('button', { name: t('editor.toast.restore'), exact: true }).click();
    await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length);
    await expect(row(page, 0).getByTestId('value-single')).toHaveValue(
      String((control.definition.where.children[0] as ConditionNode).value),
    );
  });

  test('the condition under the pointer fills its mark on its clause in the sentence', async ({ page, api }) => {
    await openStored(page, stored(api));
    const marks = sentence(page).getByTestId('mark');
    await expect(marks.nth(1)).toHaveAttribute('data-state', 'resting');

    await row(page, 1).hover();
    await expect(marks.nth(1)).toHaveAttribute('data-state', 'traced');
    await expect(marks.nth(0)).toHaveAttribute('data-state', 'resting');

    await sentence(page).getByTestId('clause').first().hover();
    await expect(row(page, 0).getByTestId('mark')).toHaveAttribute('data-state', 'traced');
  });

  test('archiving asks first, then leaves for the list', async ({ page, api }, testInfo) => {
    const control = stored(api);
    await openStored(page, control);

    await page.getByTestId('archive').click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText(t('editor.archive.body', { name: control.name }));
    await shot(page, testInfo, 'editor-archive-dialog');
    await dialog.getByTestId('confirm-accept').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(t('editor.toast.archived'), { exact: true })).toBeVisible();
    expect(api.controls.find((candidate) => candidate.id === control.id)!.isActive).toBe(false);
  });

  test('an archived control is read-only and can be duplicated into a new one', async ({ page, api }, testInfo) => {
    const control = stored(api);
    api.controls = api.controls.map((candidate) => (candidate.id === control.id ? { ...candidate, isActive: false } : candidate));
    await page.goto(`/controls/${control.id}`);

    const banner = page.getByTestId('archived-banner');
    await expect(banner).toContainText(t('errors.CONTROL_ARCHIVED.title'));
    await expect(page.getByTestId('archived-view')).toContainText(control.name);
    await expect(page.getByTestId('save')).toHaveCount(0);
    await expect(page.getByTestId('condition-builder')).toHaveCount(0);
    await shot(page, testInfo, 'editor-archived');

    await banner.getByRole('button', { name: t('editor.actions.duplicate'), exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/controls/new\\?from=${control.id}$`));
    await expect(page.getByTestId('control-name')).toHaveValue(t('editor.copyName', { name: control.name }));
    await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length);
  });

  test('an address of no control shows the not-found state', async ({ page }) => {
    await page.goto('/controls/987654');
    await expect(page.getByTestId('not-found')).toBeVisible();

    await page.goto('/controls/not-a-number');
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('a changed draft is guarded by the browser when the page is left', async ({ page, api }) => {
    await openStored(page, stored(api));
    await page.getByTestId('control-name').fill('changed and not saved');

    const asked = page.waitForEvent('dialog');
    void page.reload().catch(() => undefined);
    const dialog = await asked;

    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await expect(page.getByTestId('control-name')).toHaveValue('changed and not saved');
  });
});
