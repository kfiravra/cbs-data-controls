import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import { provideTestTranslations, t } from '../../../testing/translate';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  const pressed = new Subject<void>();
  const open = vi.fn((_message: string, _action?: string, _config?: MatSnackBarConfig) => ({
    onAction: () => pressed.asObservable(),
  }));

  beforeEach(() => {
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [provideTestTranslations(), { provide: MatSnackBar, useValue: { open } }],
    });
  });

  it('shows the translated line at the bottom start edge of a right-to-left page', () => {
    TestBed.inject(ToastService).show('app.title', { app: 'A', page: 'B' });

    const [message, action, config] = open.mock.calls[0];
    expect(message).toBe(t('app.title', { app: 'A', page: 'B' }));
    expect(action).toBeUndefined();
    expect(config).toMatchObject({ direction: 'rtl', horizontalPosition: 'start', verticalPosition: 'bottom' });
  });

  it('counts in the plural form of the language', () => {
    const toast = TestBed.inject(ToastService);

    toast.showCounted('results.violations', 1);
    toast.showCounted('results.violations', 23);

    expect(open.mock.calls.map(([message]) => message)).toEqual([
      t('results.violations.one'),
      t('results.violations.other', { count: 23 }),
    ]);
  });

  it('offers one text button and runs its action when the button is pressed', () => {
    let ran = 0;
    TestBed.inject(ToastService).show('app.name', {}, { labelKey: 'common.close', run: () => ran++ });

    expect(open.mock.calls[0][1]).toBe(t('common.close'));
    expect(ran).toBe(0);

    pressed.next();
    expect(ran).toBe(1);
  });
});
