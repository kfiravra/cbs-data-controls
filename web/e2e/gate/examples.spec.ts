import { Page } from '@playwright/test';

import { Example, exampleNumber, markedIds } from '../fixtures/examples';
import { glossary } from '../fixtures/glossary';
import { BuilderDriver } from '../support/builder-driver';
import { controlIdOf, expect, test } from '../support/gate';
import { t } from '../support/i18n';
import { shot } from '../support/shots';

const letters = t('common.markLetters').split(' ');
const lang = glossary.defaultLanguage;

/**
 * What a run of an example must show: the total, exactly the expected records, and on each record the
 * marks of the conditions it matched. Marks are compared, not node ids: the editor gave the built control
 * its own ids, and a mark is the letter of a node's place in the definition.
 */
async function expectResults(page: Page, example: Example): Promise<void> {
  const rows = page.getByTestId('result-row');
  await expect(page.getByTestId('run-total')).toHaveText(String(example.expected.total));
  await expect(rows).toHaveCount(example.expected.total);

  const keys = await rows.evaluateAll((found) => found.map((row) => row.getAttribute('data-key')));
  expect(new Set(keys)).toEqual(new Set(example.expected.violations.map((violation) => violation.key)));

  const order = markedIds(example.definition.where);
  for (const violation of example.expected.violations) {
    const row = page.locator(`[data-testid="result-row"][data-key="${violation.key}"]`);
    await expect(row.getByTestId('reason').getByTestId('mark'), `record ${violation.key}`).toHaveText(
      violation.matched.map((id) => letters[order.indexOf(id)]),
    );
  }
}

/**
 * The gate of the client: each of the six examples is built in the editor's panel from glossary terms, by
 * one driver that knows no example, saved, run on the real engine, and read back record by record in the
 * results panel. A run from
 * the interface uses today's date; the expected records hold for every run date from 2026-11-01 to
 * 2027-12-31, so no run date is sent.
 */
test.describe('the six examples on the real stack', () => {
  for (const number of [1, 2, 3, 4, 5, 6] as const) {
    test(`example ${number} is built in the editor, saved, run and read`, async ({ page, gate }, testInfo) => {
      const example = exampleNumber(number);
      await page.goto('/controls/new');
      // a new control asks what to check before it has any condition: the driver answers first
      await expect(page.getByTestId('root-entity').first()).toBeVisible();
      await expect(page.getByTestId('condition-builder')).toHaveCount(0);

      await page.getByTestId('control-name').fill(gate.nameOf(example));
      await page.getByTestId('control-description').fill(example.description[lang]);
      await new BuilderDriver(page).build(example.definition);

      // the engine reads the control back: one mark per condition, and nothing left unfinished
      const sentence = page.getByTestId('sentence');
      await expect(sentence).toHaveAttribute('data-stale', 'false');
      await expect(sentence.getByTestId('mark')).toHaveText(
        letters.slice(0, markedIds(example.definition.where).length),
      );
      await expect(page.getByTestId('sentence-status')).toHaveCount(0);
      if (number === 4) {
        await shot(page, testInfo, 'gate-editor');
      }

      await page.getByTestId('save').click();
      await expect(page).toHaveURL(/\/controls\/\d+$/);
      gate.own(controlIdOf(page.url()));

      await page.getByTestId('save-run').click();
      await expect(page).toHaveURL(/\/runs\/\d+$/);
      await expect(page.getByTestId('panel-title')).toHaveText(gate.nameOf(example));
      await expectResults(page, example);
      if (number === 4) {
        // the toast of the save rides along to this screen and would stand over the records in the shot; it
        // lives six seconds (TOAST_MS of the toast service), and "save and run" shows none of its own
        await expect(page.getByText(t('editor.toast.saved'), { exact: true })).toBeHidden({ timeout: 10_000 });
        await shot(page, testInfo, 'gate-results');
      }
      if (number === 1) {
        // a results page is an address: opened again from nothing, it shows the same run
        await page.reload();
        await expectResults(page, example);
      }
    });
  }
});
