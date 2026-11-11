import { Page, expect } from '@playwright/test';

import { Control } from '../../src/app/core/api/api.types';
import { exampleNumber } from '../fixtures/examples';
import { t } from './i18n';
import { FakeApi } from './routes';

/** What the mocked specs of the editor share: the stored control they open, and where they look. */
export const letters = t('common.markLetters').split(' ');

/** The stored control of example 1: two conditions, both with a typed number. */
export function stored(api: FakeApi): Control {
  const example = exampleNumber(1);
  return api.controls.find((control) => JSON.stringify(control.definition) === JSON.stringify(example.definition))!;
}

export async function openStored(page: Page, control: Control): Promise<void> {
  await page.goto(`/controls/${control.id}`);
  await expect(page.getByTestId('control-name')).toHaveValue(control.name);
  await expect(page.getByTestId('condition-row')).toHaveCount(control.definition.where.children.length);
}

/** The panel: the list stands behind it, with banners of its own. */
export const ui = (page: Page) => page.getByTestId('panel');
export const sentence = (page: Page) => page.getByTestId('sentence');
export const row = (page: Page, index: number) => page.getByTestId('condition-row').nth(index);
