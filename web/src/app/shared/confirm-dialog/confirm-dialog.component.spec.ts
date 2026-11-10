import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';

import { provideTestIcons } from '../../../testing/icons';
import { provideTestTranslations, t } from '../../../testing/translate';
import { confirm } from './confirm-dialog.component';

describe('confirm dialog', () => {
  const DATA = { title: 'archive?', body: 'it leaves the list', confirmLabel: 'archive' };
  const panel = () => document.querySelector<HTMLElement>('[data-testid="confirm-dialog"]')!;
  const buttonNamed = (name: string) =>
    [...panel().querySelectorAll('button')].find((button) => button.textContent?.trim() === name)!;

  async function ask(): Promise<{ answers: boolean[] }> {
    const answers: boolean[] = [];
    confirm(TestBed.inject(MatDialog), DATA).subscribe((answer) => answers.push(answer));
    await new Promise((resolve) => setTimeout(resolve));
    return { answers };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTestTranslations(),
        provideTestIcons(),
        // jsdom runs no CSS animation, and a dialog reports its close only when its exit animation ends
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('asks with the title, the body and the name of the action', async () => {
    await ask();

    expect(panel().textContent).toContain(DATA.title);
    expect(panel().textContent).toContain(DATA.body);
    expect(buttonNamed(DATA.confirmLabel)).toBeDefined();
  });

  it('answers yes when the action is confirmed', async () => {
    const { answers } = await ask();

    buttonNamed(DATA.confirmLabel).click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(answers).toEqual([true]);
  });

  it('answers no when the dialog is cancelled', async () => {
    const { answers } = await ask();

    buttonNamed(t('common.cancel')).click();
    await new Promise((resolve) => setTimeout(resolve));

    expect(answers).toEqual([false]);
  });
});
