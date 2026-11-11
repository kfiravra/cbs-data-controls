import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

import { CountedService } from '../../core/i18n/counted.service';
import { LanguageService } from '../../core/i18n/language.service';

export interface ToastAction {
  readonly labelKey: string;
  readonly run: () => void;
}

/** A toast that was shown: it can be taken away before its time, when its action no longer fits the screen. */
export interface ToastRef {
  /** Takes this toast away; nothing happens if it is already gone or another toast took its place. */
  dismiss(): void;
}

const TOAST_MS = 6000;

/** One line and at most one text button, at the bottom start edge. Never for an error. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly counted = inject(CountedService);

  /** A line that counts something: the plural form the language has for the count. */
  showCounted(baseKey: string, count: number): void {
    this.open(this.counted.text(baseKey, count));
  }

  /** `duration` is for a toast whose action is the only way back to something: it has to be reached in time. */
  show(messageKey: string, params: Record<string, unknown> = {}, action?: ToastAction, duration = TOAST_MS): ToastRef {
    return this.open(this.translate.instant(messageKey, params) as string, action, duration);
  }

  private open(message: string, action?: ToastAction, duration = TOAST_MS): ToastRef {
    const label: string | undefined = action ? this.translate.instant(action.labelKey) : undefined;
    const ref = this.snackBar.open(message, label, {
      duration,
      // styled as the toast of this product (`_states.scss`): it stands over the bar at the bottom of the window
      panelClass: 'app-toast',
      // without the direction Material reads 'start' as the left edge
      direction: this.language.dir,
      horizontalPosition: 'start',
      verticalPosition: 'bottom',
    });
    if (action) {
      ref.onAction().subscribe(() => action.run());
    }
    return ref;
  }
}
