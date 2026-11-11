import { Page, expect } from '@playwright/test';

import { Control } from '../../src/app/core/api/api.types';
import { exampleNumber } from '../fixtures/examples';
import { StoredRun } from '../fixtures/runs';
import { t } from './i18n';
import { FakeApi } from './routes';

/** What the mocked specs of the results panel share: the run they open, and where they look. */
export const letters = t('common.markLetters').split(' ');
export const RUN = 500;

export function controlOf(api: FakeApi, number: 1 | 2 | 3 | 4 | 5 | 6): Control {
  const wanted = JSON.stringify(exampleNumber(number).definition);
  return api.controls.find((control) => JSON.stringify(control.definition) === wanted)!;
}

/** The panel: the list stands behind it with a toolbar, a table and a foot of its own, so everything is looked for in here. */
export const ui = (page: Page) => page.getByTestId('panel');
export const rows = (page: Page) => ui(page).getByTestId('result-row');
export const breakdown = (page: Page) => ui(page).getByTestId('breakdown-row');

export async function open(page: Page, stored: StoredRun, query = ''): Promise<void> {
  await page.goto(`/runs/${stored.run.id}${query}`);
  await expect(ui(page).getByTestId('panel-title')).toHaveText(stored.run.controlName);
}
