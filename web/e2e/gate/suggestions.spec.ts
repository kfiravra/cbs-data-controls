import { AcceptAnswer, AcceptBody, SuggestionsAnswer } from '../../src/app/core/api/api.types';
import { expect, test } from '../support/gate';
import { shot } from '../support/shots';

/**
 * The suggestions dialog on the real stack. The drafts are whatever the engine proposes over the data: the
 * test asserts what that answer holds and no fixed number. It then creates the first draft: the only run of
 * "create selected" against the real api.
 */
test('the dialog shows the drafts the engine proposes, and creates one as a control', async ({ page, gate }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('page-meta')).toBeVisible();

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

  // the dialog has no rename, and nothing may be created under a bare name the loaded examples could
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
