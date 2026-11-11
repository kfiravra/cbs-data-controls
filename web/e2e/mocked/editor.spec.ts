import { Control } from '../../src/app/core/api/api.types';
import { ConditionNode } from '../../src/app/core/definition/definition.types';
import { exampleNumber } from '../fixtures/examples';
import { glossary, label } from '../fixtures/glossary';
import { engine } from '../fixtures/runs';
import { BuilderDriver } from '../support/builder-driver';
import { normalized } from '../support/definitions';
import { letters, openStored, row, sentence, stored, ui } from '../support/editor-screen';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { problem } from '../support/routes';
import { shot } from '../support/shots';

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
    await expect(page.getByTestId('page-meta')).toContainText('1');
    // the list behind the panel was read again: it holds the new control
    await expect(page.locator(`[data-testid="control-row"][data-id="${api.controls.at(-1)!.id}"]`)).toHaveCount(1);
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
    await page.getByTestId('save').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(t('editor.toast.saved'), { exact: true })).toBeVisible();
    expect(api.controls.find((candidate) => candidate.id === control.id)!.version).toBe(1);
    // the button was unavailable while it saved and kept the focus: the keyboard goes on from where it was
    await expect(page.getByTestId('save')).toBeFocused();

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
    await expect(ui(page).getByTestId('error-banner')).toHaveCount(0);
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
    await expect(page.getByTestId('sentence-hint')).toHaveText(t('editor.sentence.hintInvalid'));
    await expect(page.getByText('a_field_that_is_gone')).toHaveCount(0);
    await shot(page, testInfo, 'editor-outdated');
  });

  test('an engine that does not answer leaves the screen in place and offers to try again', async ({ page, api }, testInfo) => {
    const control = stored(api);
    api.fail('POST /controls/validate', problem(503, 'ENGINE_UNAVAILABLE'));
    await openStored(page, control);

    const banner = ui(page).getByTestId('error-banner');
    await expect(banner).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(banner).toContainText(t('errors.ENGINE_UNAVAILABLE.title'));
    // both conditions are complete: the field must not say it waits for a first one
    await expect(page.getByTestId('sentence-hint')).toHaveText(t('editor.sentence.hintUnavailable'));
    await shot(page, testInfo, 'editor-engine-down');

    api.heal('POST /controls/validate');
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');
    await expect(banner).toHaveCount(0);
  });

  test('a glossary that cannot be read is said under the page head, and read again on request', async ({ page, api }) => {
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await page.goto('/controls/new');

    const banner = ui(page).getByTestId('error-banner');
    await expect(banner).toHaveAttribute('data-code', 'ENGINE_UNAVAILABLE');
    await expect(page.getByTestId('control-name')).toBeVisible();

    // without the glossary there is nothing to choose from: the question waits for it
    await expect(page.getByTestId('root-entity')).toHaveCount(0);

    api.heal('GET /glossary');
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(page.getByTestId('root-entity')).toHaveCount(glossary.entities.filter((entity) => entity.rootable).length);
    await expect(banner).toHaveCount(0);
  });

  test('a stored control whose glossary could not be read is built once the glossary is read again', async ({ page, api }) => {
    const control = stored(api);
    api.fail('GET /glossary', problem(503, 'ENGINE_UNAVAILABLE'));
    await page.goto(`/controls/${control.id}`);
    await expect(page.getByTestId('control-name')).toHaveValue(control.name);
    await expect(page.getByTestId('condition-builder')).toHaveCount(0);

    api.heal('GET /glossary');
    await ui(page).getByTestId('error-banner').getByRole('button', { name: t('common.retry'), exact: true }).click();

    await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length);
    await expect(ui(page).getByTestId('error-banner')).toHaveCount(0);
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

  test('another choice of what to check starts the conditions over, and the toast brings them back', async ({ page, api }) => {
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

  test('a row and its clause answer nothing to the pointer: a mark is a badge here too', async ({ page, api }) => {
    await openStored(page, stored(api));
    const inSentence = sentence(page).getByTestId('mark');
    const onRow = row(page, 0).getByTestId('mark');
    const fill = (mark: typeof onRow) => mark.evaluate((element) => getComputedStyle(element).backgroundColor);
    await expect(inSentence.nth(1)).toHaveAttribute('data-state', 'resting');
    const resting = { sentence: await fill(inSentence.nth(1)), row: await fill(onRow) };

    await row(page, 1).hover();
    await expect(inSentence.nth(1)).toHaveAttribute('data-state', 'resting');
    expect(await fill(inSentence.nth(1))).toBe(resting.sentence);

    await sentence(page).getByTestId('clause').first().hover();
    await expect(onRow).toHaveAttribute('data-state', 'resting');
    expect(await fill(onRow)).toBe(resting.row);
  });

  test('an archived control is read-only and can be duplicated into a new one', async ({ page, api }, testInfo) => {
    const control = stored(api);
    api.controls = api.controls.map((candidate) => (candidate.id === control.id ? { ...candidate, isActive: false } : candidate));
    await page.goto(`/controls/${control.id}`);

    const banner = page.getByTestId('archived-banner');
    await expect(banner).toContainText(t('errors.CONTROL_ARCHIVED.title'));
    await expect(page.getByTestId('archived-view')).toContainText(control.name);
    // it can be read: its rule is there in words, under its name
    await expect(page.getByTestId('archived-view').getByTestId('mark')).toHaveText(letters.slice(0, 2));
    await expect(page.getByTestId('save')).toHaveCount(0);
    await expect(page.getByTestId('sentence-field')).toHaveCount(0);
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

  test('a removed condition is offered back by the toast, with its value and its mark', async ({ page, api }) => {
    const control = stored(api);
    const count = control.definition.where.children.length;
    await openStored(page, control);
    const value = String((control.definition.where.children[1] as ConditionNode).value);
    await expect(row(page, 1).getByTestId('value-single')).toHaveValue(value);

    await row(page, 1).getByTestId('remove-row').click();
    await expect(page.getByTestId('condition-row')).toHaveCount(count - 1);
    await expect(page.getByText(t('editor.toast.removedCondition', { mark: letters[1] }), { exact: true })).toBeVisible();

    await page.getByRole('button', { name: t('editor.toast.restore'), exact: true }).click();
    await expect(page.getByTestId('condition-row')).toHaveCount(count);
    await expect(row(page, 1).getByTestId('value-single')).toHaveValue(value);
    await expect(row(page, 1).getByTestId('mark')).toHaveText(letters[1]);
  });

  test('the offer to bring a removed condition back is withdrawn by the next edit', async ({ page, api }) => {
    await openStored(page, stored(api));
    const restore = page.getByRole('button', { name: t('editor.toast.restore'), exact: true });

    await row(page, 1).getByTestId('remove-row').click();
    await expect(restore).toBeVisible();

    // the way back leads to the draft before the removal: taken now, it would undo this edit too
    await row(page, 0).getByTestId('value-single').fill('17');
    await expect(restore).toHaveCount(0);
  });

  test('a first save moves to the saved address unasked, also when something was typed while it saved', async ({ page, api }) => {
    const example = exampleNumber(1);
    api.delay('POST /controls', 500);
    let asked = false;
    page.on('dialog', (dialog) => {
      asked = true;
      void dialog.dismiss();
    });
    await page.goto('/controls/new');
    await page.getByTestId('control-name').fill('typed before the save');
    await new BuilderDriver(page).build(example.definition);
    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');

    await page.getByTestId('save').click();
    await page.getByTestId('control-description').fill('typed while it saved');

    await expect(page).toHaveURL(/\/controls\/\d+$/);
    expect(asked).toBe(false);
    await expect(page.getByTestId('control-description')).toHaveValue('typed while it saved');
  });

  test('a changed draft closes at once, with no question, and the toast brings it back as it was', async ({ page, api }, testInfo) => {
    const control = stored(api);
    await openStored(page, control);
    let asked = false;
    page.on('dialog', (dialog) => {
      asked = true;
      void dialog.dismiss();
    });
    const restore = page.getByRole('button', { name: t('editor.toast.restore'), exact: true });
    await page.getByTestId('control-name').fill('changed and not saved');
    await row(page, 1).getByTestId('remove-row').click();
    await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length - 1);

    // the X closes the panel at once: no prompt of the browser, no dialog of the app
    await page.getByTestId('panel-close').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(ui(page)).toHaveCount(0);
    expect(asked).toBe(false);
    await expect(page.getByText(t('editor.toast.closed'))).toBeVisible();

    // the toast's one button puts the draft back on the screen, at its own address, still unsaved
    await restore.click();
    await expect(page).toHaveURL(new RegExp(`/controls/${control.id}$`));
    await expect(page.getByTestId('control-name')).toHaveValue('changed and not saved');
    await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length - 1);
    expect(api.callsTo(`GET /controls/${control.id}`)).toHaveLength(1);

    // Esc closes at once as well, and so does a click beside the panel where the list shows
    await page.getByTestId('control-name').press('Escape');
    await expect(ui(page)).toHaveCount(0);
    await restore.click();
    await expect(page.getByTestId('control-name')).toHaveValue('changed and not saved');
    if (testInfo.project.name === 'desktop') {
      await page.getByTestId('panel-scrim').click({ position: { x: 8, y: 8 } });
      await expect(ui(page)).toHaveCount(0);
      await restore.click();
      await expect(page.getByTestId('control-name')).toHaveValue('changed and not saved');
    }
    expect(asked).toBe(false);

    // what came back is the stored control's draft: it saves over it, with its token
    await page.getByTestId('save').click();
    await expect.poll(() => api.callsTo(`PUT /controls/${control.id}`).length).toBe(1);
    expect(api.callsTo(`PUT /controls/${control.id}`)[0].body).toMatchObject({
      name: 'changed and not saved',
      concurrencyToken: control.concurrencyToken,
    });

    // a saved control has nothing to bring back: closing it says nothing
    await expect(page.getByText(t('editor.toast.saved'), { exact: false }).first()).toBeVisible();
    await page.getByTestId('panel-close').click();
    await expect(ui(page)).toHaveCount(0);
    await expect(page.getByText(t('editor.toast.closed'))).toHaveCount(0);
  });

  test('a new control that was closed comes back with its choice, its name and its conditions', async ({ page, api }) => {
    await page.goto('/controls/new');
    await page.getByTestId('root-entity').first().click();
    await page.getByTestId('control-name').fill('not saved yet');
    await page.locator('[data-adder="condition"]').click();
    await expect(page.getByTestId('condition-row')).toHaveCount(2);

    await page.getByTestId('panel-close').click();
    await expect(ui(page)).toHaveCount(0);
    await page.getByRole('button', { name: t('editor.toast.restore'), exact: true }).click();

    await expect(page).toHaveURL(/\/controls\/new$/);
    await expect(page.getByTestId('control-name')).toHaveValue('not saved yet');
    await expect(page.getByTestId('root-entity').first()).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('condition-row')).toHaveCount(2);
    expect(api.callsTo('POST /controls')).toHaveLength(0);

    // an untouched new control has nothing to lose: closing it says nothing
    await page.getByTestId('panel-close').click();
    await page.getByRole('button', { name: t('editor.toast.restore'), exact: true }).click();
    await page.getByTestId('panel-close').click();
    await page.goto('/controls/new');
    await page.getByTestId('panel-close').click();
    await expect(ui(page)).toHaveCount(0);
    await expect(page.getByText(t('editor.toast.closed'))).toHaveCount(0);
  });

  test('a panel that was closed while a save was on its way stays closed when the save lands', async ({ page, api }) => {
    const control = stored(api);
    api.delay(`PUT /controls/${control.id}`, 700);
    await openStored(page, control);
    await page.getByTestId('control-name').fill(`${control.name} 2`);

    await page.getByTestId('save-run').click();
    await expect(page.getByTestId('save-run')).toBeDisabled();
    // the draft is being stored at this moment: the panel closes, and offers no draft back
    await page.getByTestId('panel-close').click();
    await expect(ui(page)).toHaveCount(0);
    await expect(page.getByText(t('editor.toast.closed'))).toHaveCount(0);

    // the save lands and the run after it: the control is saved and ran, and the panel stays closed
    await expect.poll(() => api.callsTo(`POST /controls/${control.id}/runs`).length).toBe(1);
    await expect(page.getByText(`${control.name} 2`, { exact: true })).toBeVisible();
    await expect(ui(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test('an unchanged control is left without a question, and Esc on an open select closes the select only', async ({ page, api }) => {
    await openStored(page, stored(api));
    let asked = false;
    page.on('dialog', (dialog) => {
      asked = true;
      void dialog.accept();
    });

    await row(page, 0).getByTestId('operator-picker').click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(ui(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/\/$/);
    await expect(ui(page)).toHaveCount(0);
    expect(asked).toBe(false);
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
