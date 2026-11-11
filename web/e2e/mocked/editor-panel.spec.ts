import { glossary, label } from '../fixtures/glossary';
import { engine } from '../fixtures/runs';
import { openStored, row, sentence, stored, ui } from '../support/editor-screen';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { problem } from '../support/routes';
import { sheetInset, shot } from '../support/shots';

test.describe('control editor: what to check, suggestions for it, and the bar', () => {
  test('a new control asks what to check: a card for each thing of the glossary, nothing chosen, and how they connect', async ({ page }, testInfo) => {
    const rootable = glossary.entities.filter((entity) => entity.rootable);
    await page.goto('/controls/new');
    const cards = page.getByTestId('root-entity');

    await expect(page.getByRole('radiogroup', { name: t('editor.what.title'), exact: true })).toBeVisible();
    await expect(cards).toHaveCount(rootable.length);
    for (const [index, entity] of rootable.entries()) {
      await expect(cards.nth(index)).toContainText(label(entity.label.plural));
      await expect(cards.nth(index)).toContainText(label(entity.description));
      await expect(cards.nth(index)).toHaveAttribute('aria-checked', 'false');
    }
    // the chain is a picture to read: every thing in it, a line of words between two that connect, no control
    const chain = page.getByTestId('entity-chain');
    await expect(chain.getByTestId('chain-node')).toHaveText(rootable.map((entity) => label(entity.label.plural)));
    await expect(chain.getByTestId('chain-link').first()).not.toBeEmpty();
    await expect(chain.locator('button, a, [tabindex], [role="radio"]')).toHaveCount(0);
    await expect(page.getByTestId('condition-builder')).toHaveCount(0);
    await shot(page, testInfo, 'editor-what');

    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(chain.locator('.is-chosen')).toHaveText(label(rootable[1].label.plural));
    await expect(page.getByTestId('root-summary')).toContainText(t('editor.what.returns', { entity: label(rootable[1].label.plural) }));
    await expect(page.getByTestId('condition-row')).toHaveCount(1);
  });

  test('a save before it is chosen what to check asks for the choice and sends nothing', async ({ page, api }) => {
    await page.goto('/controls/new');
    await page.getByTestId('control-name').fill('a name');

    await page.getByTestId('save').click();

    await expect(page.getByTestId('what-error')).toHaveText(t('editor.what.required'));
    await expect(page.getByTestId('root-entity').first()).toBeFocused();
    expect(api.callsTo('POST /controls')).toHaveLength(0);

    // the arrows move between the cards and choose nothing; Space chooses the card the focus is on
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('root-entity').nth(1)).toBeFocused();
    await expect(page.getByTestId('root-entity').and(page.locator('[aria-checked="true"]'))).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('root-entity').nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('what-error')).toHaveCount(0);
  });

  test('passing over the cards with the arrows leaves a stored control\'s conditions as they are', async ({ page, api }) => {
    const control = stored(api);
    await openStored(page, control);
    const count = control.definition.where.children.length;

    await page.getByTestId('root-entity').and(page.locator('[aria-checked="true"]')).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');

    await expect(page.getByTestId('condition-row')).toHaveCount(count);
    await expect(page.getByRole('button', { name: t('editor.toast.restore'), exact: true })).toHaveCount(0);
    await expect(page.getByTestId('root-entity').and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
  });

  test('a new control is offered up to three suggestions for its choice, and one click fills the conditions', async ({ page, api }, testInfo) => {
    const entity = glossary.entities.find((candidate) => candidate.key === api.suggestions[0].definition.rootEntity)!;
    const offered = api.suggestions.filter((item) => item.definition.rootEntity === entity.key).slice(0, 3);
    api.delay('POST /suggestions', 400);
    await page.goto('/controls/new');
    await expect(page.getByTestId('ideas')).toHaveCount(0);

    await page.getByRole('radio', { name: label(entity.label.plural) }).click();

    // their place is held while they are computed, so the conditions do not move when they arrive
    await expect(page.getByTestId('ideas-loading')).toBeVisible();
    const ideas = page.getByTestId('idea');
    await expect(ideas).toHaveCount(offered.length);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.length).toBeLessThanOrEqual(3);
    await expect(page.getByTestId('ideas')).toContainText(t('editor.ideas.hint'));
    await expect(ideas.first()).toContainText(offered[0].name);
    await expect(ideas.first()).toContainText(offered[0].evidence[0].text);
    expect(api.callsTo('POST /suggestions').at(-1)!.body).toEqual({ rootEntity: entity.key, max: 3 });
    await shot(page, testInfo, 'editor-ideas');

    await ideas.first().click();

    await expect(page.getByTestId('control-name')).toHaveValue(offered[0].name);
    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');
    await expect(sentence(page)).toContainText(engine.sentenceOf(offered[0].definition).conditions[0].sentence.split(' ').slice(1).join(' '));
    expect(api.callsTo('POST /controls')).toHaveLength(0);

    // one press is not final: the toast gives back what was there
    await page.getByRole('button', { name: t('editor.toast.restore'), exact: true }).click();
    await expect(page.getByTestId('condition-row')).toHaveCount(1);
    await expect(page.getByTestId('control-name')).toHaveValue('');
  });

  test('nothing stands where the suggestions would be when there are none, and a stored control is offered none', async ({ page, api }) => {
    api.suggestions = [];
    await page.goto('/controls/new');
    await page.getByTestId('root-entity').first().click();
    await expect(page.getByTestId('condition-row')).toHaveCount(1);
    await expect(page.getByTestId('ideas')).toHaveCount(0);

    // an engine that does not answer is no failure of the editor
    api.fail('POST /suggestions', problem(503, 'ENGINE_UNAVAILABLE'));
    await page.getByTestId('root-entity').nth(1).click();
    await expect(page.getByTestId('root-entity').nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('ideas')).toHaveCount(0);
    await expect(ui(page).getByTestId('error-banner')).toHaveCount(0);

    page.once('dialog', (dialog) => void dialog.accept());
    await openStored(page, stored(api));
    await expect(page.getByTestId('ideas')).toHaveCount(0);
  });

  test('the name and the description keep one width that is easy to read, and the description is two rows', async ({ page, api }, testInfo) => {
    await openStored(page, stored(api));
    const name = (await page.getByTestId('control-name').boundingBox())!;
    const description = page.getByTestId('control-description');
    const box = (await description.boundingBox())!;

    expect(Math.round(name.width)).toBe(Math.round(box.width));
    if (testInfo.project.name === 'desktop') {
      // not the width of the panel: a line of about seventy characters
      expect(name.width).toBeLessThanOrEqual(640);
      expect(name.width).toBeGreaterThan(480);
    }
    await expect(description).toHaveAttribute('rows', '2');
    expect(await description.evaluate((area) => getComputedStyle(area).resize)).toBe('none');
    // more text does not make the field taller: it scrolls inside its two rows
    await description.fill(Array.from({ length: 12 }, (_, line) => `line ${line}`).join('\n'));
    expect(Math.round((await description.boundingBox())!.height)).toBe(Math.round(box.height));
  });

  test('the rule in words stays in view at the foot of the panel, beside the save, and the bar never changes its height', async ({ page, api }, testInfo) => {
    const control = stored(api);
    await openStored(page, control);
    const bar = page.getByTestId('sentence-field');
    await expect(sentence(page)).toHaveAttribute('data-stale', 'false');
    const before = (await bar.boundingBox())!;
    const viewport = page.viewportSize()!;

    // at the foot of the panel, whole, with the two buttons in it
    expect(Math.round(before.y + before.height)).toBe(viewport.height - (await sheetInset(page)));
    await expect(bar.getByTestId('save')).toBeInViewport();
    await expect(bar.getByTestId('save-run')).toBeInViewport();

    // the body scrolls under it, to its end and back
    await ui(page).getByTestId('panel-body').evaluate((body) => body.scrollTo(0, body.scrollHeight));
    await expect(sentence(page)).toBeInViewport();
    expect(await bar.boundingBox()).toEqual(before);

    // a status line arriving, a sentence dimmed, a row removed: the bar stays as it is
    await row(page, 1).getByTestId('value-single').fill('');
    await expect(page.getByTestId('sentence-status')).toBeVisible();
    expect(await bar.boundingBox()).toEqual(before);
    await shot(page, testInfo, 'editor-bar-status');
    await row(page, 1).getByTestId('remove-row').click();
    await expect(sentence(page).getByTestId('mark')).toHaveCount(1);
    await expect(page.getByTestId('sentence-status')).toHaveCount(0);
    expect(await bar.boundingBox()).toEqual(before);
  });
});
