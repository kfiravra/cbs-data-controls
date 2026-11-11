import { Page } from '@playwright/test';

import { examples } from '../fixtures/examples';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { problem } from '../support/routes';
import { sheetInset, shot } from '../support/shots';

const dialog = (page: Page) => page.getByTestId('suggestions-dialog');
const drafts = (page: Page) => dialog(page).getByTestId('suggestion');

async function openDialog(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('control-row').first()).toBeVisible();
  await page.getByTestId('open-suggestions').click();
  await expect(dialog(page)).toBeVisible();
}

test.describe('suggestions panel', () => {
  test('shows the engine drafts as cards with their sentence and marks, none ticked, and saves or runs nothing', async ({ page, api }, testInfo) => {
    api.delay('POST /suggestions', 500);
    await openDialog(page);
    await expect(dialog(page).getByTestId('suggestions-loading')).toBeVisible();

    await expect(drafts(page)).toHaveCount(api.suggestions.length);
    expect(api.suggestions.length).toBeGreaterThan(0);
    for (const [index, item] of api.suggestions.entries()) {
      const draft = drafts(page).nth(index);
      await expect(draft.getByTestId('suggestion-name')).toHaveText(item.name);
      await expect(draft).toContainText(item.rationale);
      await expect(draft.getByTestId('suggestion-sentence').locator('[data-testid="clause"][data-tone="1"]').first()).toBeVisible();
      await expect(draft.getByTestId('suggestion-sentence').getByTestId('mark')).toHaveCount(0);
      // a card shows no letter, so what is read aloud is the engine's sentence and names no condition
      await expect(draft.getByTestId('suggestion-sentence').getByTestId('plain-text')).toHaveText(item.sentence);
      await expect(draft.getByTestId('evidence')).toHaveText(item.evidence.map((evidence) => evidence.text));
      await expect(draft.getByRole('checkbox')).not.toBeChecked();
    }
    await expect(dialog(page).getByTestId('suggestions-create')).toBeDisabled();
    expect(api.calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /suggestions',
    ]);
    // one line says where they come from: the data as they are now
    await expect(dialog(page).getByTestId('page-meta')).toHaveText(t('suggestions.note'));
    await shot(page, testInfo, 'suggestions');

    // a wide panel, as tall as the window; from 900px of its width the cards stand two in a row
    const box = (await dialog(page).boundingBox())!;
    expect(box.height).toBe(page.viewportSize()!.height - 2 * (await sheetInset(page)));
    const [first, second] = [(await drafts(page).nth(0).boundingBox())!, (await drafts(page).nth(1).boundingBox())!];
    if (testInfo.project.name === 'desktop') {
      expect(box.width).toBeGreaterThan(900);
      expect(Math.round(first.y)).toBe(Math.round(second.y));
    } else {
      expect(second.y).toBeGreaterThan(first.y);
    }
  });

  test('computes the suggestions again on refresh, from the data as they then are', async ({ page, api }) => {
    await openDialog(page);
    await expect(drafts(page)).toHaveCount(api.suggestions.length);
    await drafts(page).nth(0).getByRole('checkbox').check();
    const kept = api.suggestions.slice(1, 3);

    // the data moved on: the engine now proposes less
    api.suggestions = kept;
    api.delay('POST /suggestions', 400);
    const refresh = dialog(page).getByTestId('suggestions-refresh');
    await refresh.focus();
    await page.keyboard.press('Enter');
    // the cards stay while the new ones are computed, and the button keeps the focus
    await expect(refresh).toBeDisabled();
    await expect(refresh).toBeFocused();
    await expect(drafts(page).first()).toBeVisible();

    await expect(drafts(page)).toHaveCount(kept.length);
    await expect(drafts(page).getByTestId('suggestion-name')).toHaveText(kept.map((item) => item.name));
    await expect(dialog(page).getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(dialog(page).getByTestId('suggestions-create')).toBeDisabled();
    expect(api.callsTo('POST /suggestions')).toHaveLength(2);
    expect(api.callsTo('POST /suggestions/accept')).toHaveLength(0);
  });

  test('creates the ticked drafts as controls, says how many, and shows them in the list', async ({ page, api }) => {
    await openDialog(page);
    const before = api.controls.length;

    await drafts(page).nth(0).getByRole('checkbox').check();
    await drafts(page).nth(2).getByRole('checkbox').check();
    const create = dialog(page).getByTestId('suggestions-create');
    await expect(create).toHaveText(t('suggestions.create.other', { count: 2 }));
    await create.click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText(t('suggestions.toast.created.two'), { exact: true })).toBeVisible();
    const [accepted] = api.callsTo('POST /suggestions/accept');
    expect((accepted.body as { items: { name: string }[] }).items.map((item) => item.name)).toEqual([
      api.suggestions[0].name,
      api.suggestions[2].name,
    ]);
    await expect(page.getByTestId('control-row')).toHaveCount(before + 2);
  });

  test('opens a draft in the editor with its name and its conditions, and creates nothing', async ({ page, api }) => {
    await openDialog(page);
    const item = api.suggestions[1];

    await drafts(page).nth(1).getByTestId('suggestion-edit').click();

    await expect(page).toHaveURL(/\/controls\/new$/);
    await expect(page.getByTestId('control-name')).toHaveValue(item.name);
    await expect(page.getByTestId('sentence').locator('[data-testid="clause"][data-tone="1"]').first()).toBeVisible();
    expect(api.callsTo('POST /suggestions/accept')).toHaveLength(0);
    expect(api.controls).toHaveLength(examples.length);
  });

  test('marks the draft the server refuses and creates none of the selection', async ({ page, api }, testInfo) => {
    api.fail('POST /suggestions/accept', problem(422, 'DEFINITION_INVALID', { index: 1 }, []));
    await openDialog(page);

    await drafts(page).nth(0).getByRole('checkbox').check();
    await drafts(page).nth(3).getByRole('checkbox').check();
    await dialog(page).getByTestId('suggestions-create').click();

    await expect(drafts(page).nth(3).getByTestId('suggestion-error')).toHaveText(t('suggestions.invalid'));
    await expect(drafts(page).nth(0).getByTestId('suggestion-error')).toHaveCount(0);
    await expect(dialog(page)).toBeVisible();
    await shot(page, testInfo, 'suggestions-refused');
  });

  test('says so when there is nothing to suggest, and why when suggestions cannot be read', async ({ page, api }) => {
    api.suggestions = [];
    await openDialog(page);
    await expect(dialog(page).getByTestId('suggestions-empty')).toHaveText(t('suggestions.empty'));
    await dialog(page).getByTestId('suggestions-close').click();
    await expect(dialog(page)).toHaveCount(0);

    api.fail('POST /suggestions', problem(503, 'ENGINE_UNAVAILABLE'));
    await page.getByTestId('open-suggestions').click();
    const banner = dialog(page).getByTestId('error-banner');
    await expect(banner).toContainText(t('errors.ENGINE_UNAVAILABLE.title'));

    api.heal('POST /suggestions');
    api.suggestions = [];
    await banner.getByRole('button', { name: t('common.retry'), exact: true }).click();
    await expect(dialog(page).getByTestId('suggestions-empty')).toBeVisible();
  });

  test('keeps the focus inside while open and gives it back to the button that opened it', async ({ page }) => {
    await openDialog(page);
    // the keyboard starts from the panel itself, as in the panel of a control or a run
    expect(await page.evaluate(() => document.activeElement?.contains(document.querySelector('[data-testid="suggestions-dialog"]')))).toBe(true);

    for (let step = 0; step < 30; step++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="suggestions-dialog"]') !== null)).toBe(true);
    }

    // from a button without a tooltip: on one that shows a tooltip, the first Escape closes the tooltip
    await dialog(page).getByTestId('suggestions-close').focus();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId('open-suggestions')).toBeFocused();
  });

  test('opens from the first-use state of an empty list too', async ({ page, api }) => {
    api.controls = [];
    await page.goto('/');

    await page.getByTestId('first-use').getByRole('button', { name: t('list.actions.suggestions') }).click();

    await expect(drafts(page)).toHaveCount(api.suggestions.length);
  });
});
