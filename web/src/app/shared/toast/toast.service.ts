import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../core/i18n/language.service';

export interface ToastAction {
  readonly labelKey: string;
  readonly run: () => void;
}

const TOAST_MS = 6000;

/** One line and at most one text button, at the bottom start edge. Never for an error. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  show(messageKey: string, params: Record<string, unknown> = {}, action?: ToastAction): void {
    const message: string = this.translate.instant(messageKey, params);
    const label: string | undefined = action ? this.translate.instant(action.labelKey) : undefined;
    const ref = this.snackBar.open(message, label, {
      duration: TOAST_MS,
      // without the direction Material reads 'start' as the left edge
      direction: this.language.dir,
      horizontalPosition: 'start',
      verticalPosition: 'bottom',
    });
    if (action) {
      ref.onAction().subscribe(() => action.run());
    }
  }
}
