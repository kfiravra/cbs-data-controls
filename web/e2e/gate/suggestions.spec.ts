import { AcceptAnswer, AcceptBody, SuggestionsAnswer } from '../../src/app/core/api/api.types';
import { expect, test } from '../support/gate';
import { shot } from '../support/shots';

/**
 * The suggestions panel on the real stack. The drafts are whatever the engine proposes over the data: the
 * test asserts what that answer holds and no fixed number. It then creates the first draft: the only run of
 * "create selected" against the real api.
 */
test('the panel shows the drafts the engine proposes, and creates one as a control', async ({ page, gate }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('tab-active').getByTestId('tab-count')).toBeVisible();

  const suggested = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/suggestions') && response.request().method() === 'POST',
  );
  await page.getByTestId('open-suggestions').click();
  const { items } = (await (await suggested).json()) as SuggestionsAnswer;
  const dialog = page.getByTestId('suggestions-dialog');
  const drafts = dialog.getByTestId('suggestion');

  expect(items.length).toBeGreaterThan(0);
  await expect(drafts).toHaveCount(items.length);
  for (const [index, item] of items.entries()) {
    const draft = drafts.nth(index);
    await expect(draft.getByTestId('suggestion-name')).toHaveText(item.name);
    await expect(draft.getByTestId('suggestion-sentence').getByTestId('mark').first()).toBeVisible();
    await expect(draft.getByRole('checkbox')).not.toBeChecked();
  }
  await shot(page, testInfo, 'gate-suggestions');

  // the panel has no rename, and nothing may be created under a bare name the loaded examples could
  // share: the tag joins the name on its way out, before the request reaches the api
  await page.route('**/api/v1/suggestions/accept', async (route) => {
    const body = route.request().postDataJSON() as AcceptBody;
    const tagged = { items: body.items.map((item) => ({ ...item, name: `${item.name} ${gate.tag}` })) };
    await route.continue({ postData: JSON.stringify(tagged) });
  });
  const accepted = page.waitForResponse((response) => response.url().endsWith('/api/v1/suggestions/accept'));
  await drafts.first().getByRole('checkbox').check();
  await dialog.getByTestId('suggestions-create').click();

  const answer = await accepted;
  expect(answer.status()).toBe(201);
  const [created] = ((await answer.json()) as AcceptAnswer).items;
  gate.own(created.id);
  expect(created.name).toBe(`${items[0].name} ${gate.tag}`);
  await expect(dialog).toHaveCount(0);

  // opened by the id the api gave it, never by its name
  await page.goto(`/controls/${created.id}`);
  await expect(page.getByTestId('control-name')).toHaveValue(created.name);
  await expect(page.getByTestId('sentence')).toHaveAttribute('data-stale', 'false');
});

/**
 * A new control on the real stack: once it is chosen what to check, the engine is asked what it would
 * suggest about that choice, and one of its answers fills the conditions. Nothing is saved.
 */
test('a new control is offered the engine\'s suggestions for its choice, and one fills its conditions', async ({ page }) => {
  await page.goto('/controls/new');
  const cards = page.getByTestId('root-entity');
  await expect(cards.first()).toBeVisible();

  const suggested = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/suggestions') && response.request().method() === 'POST',
  );
  await cards.first().click();
  const response = await suggested;
  const asked = response.request().postDataJSON() as { rootEntity: string; max: number };
  const { items } = (await response.json()) as SuggestionsAnswer;

  // the question names the choice and asks for three at most; the answer is the engine's own
  expect(asked.rootEntity).toBe(await cards.first().getAttribute('data-key'));
  expect(asked.max).toBe(3);
  expect(items.length).toBeLessThanOrEqual(3);
  const ideas = page.getByTestId('idea');
  await expect(ideas).toHaveCount(items.length);
  test.skip(items.length === 0, 'the engine proposes nothing for the first choice over this data');

  await expect(ideas.first()).toContainText(items[0].name);
  await ideas.first().click();
  await expect(page.getByTestId('control-name')).toHaveValue(items[0].name);
  // the engine reads the filled conditions back as a sentence
  await expect(page.getByTestId('sentence')).toHaveAttribute('data-stale', 'false');
});
