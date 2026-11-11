import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';

import { IconComponent } from '../icon/icon.component';

export interface ConfirmDialogData {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

/** Asks before an action that takes something out of view. Texts arrive translated. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [IconComponent, MatTooltip, TranslatePipe],
  template: `
    <div class="dialog" data-testid="confirm-dialog">
      <div class="dialog__head">
        <h2 class="t-title" id="confirm-title">{{ data.title }}</h2>
        <button
          class="icon-btn"
          type="button"
          [attr.aria-label]="'common.close' | translate"
          [matTooltip]="'common.close' | translate"
          (click)="close(false)"
        >
          <app-icon name="close" />
        </button>
      </div>
      <p>{{ data.body }}</p>
      <div class="dialog__foot">
        <button class="btn btn--secondary" type="button" (click)="close(false)">
          {{ 'common.cancel' | translate }}
        </button>
        <button class="btn btn--primary" type="button" data-testid="confirm-accept" (click)="close(true)">
          {{ data.confirmLabel }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ConfirmDialogComponent, boolean>>(MatDialogRef);

  protected close(confirmed: boolean): void {
    this.ref.close(confirmed);
  }
}

/** Opens the confirmation and answers whether the user confirmed; closing it any other way is a no. */
export function confirm(dialog: MatDialog, data: ConfirmDialogData): Observable<boolean> {
  return dialog
    .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data,
      panelClass: ['app-dialog', 'app-dialog--sm'],
      backdropClass: 'app-scrim',
      ariaLabelledBy: 'confirm-title',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
}
