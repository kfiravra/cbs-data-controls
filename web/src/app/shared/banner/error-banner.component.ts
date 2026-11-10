import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ApiError } from '../../core/api/api-error';
import { IconName } from '../../core/icons/icons';
import { BannerComponent } from './banner.component';

/** Failures of the system behind the screen, not of what the user did: drawn with the cloud, not the error mark. */
const UNREACHABLE = ['ENGINE_UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'GLOSSARY_MISMATCH', 'NETWORK_ERROR'];

/**
 * A failed call as a Danger banner: the text of its code (contracts/errors.md) from the translation file,
 * and "try again" when the caller can. `detail`, a status text and the correlation id are never shown.
 */
@Component({
  selector: 'app-error-banner',
  imports: [BannerComponent, TranslatePipe],
  template: `
    <app-banner
      tone="danger"
      data-testid="error-banner"
      [attr.data-code]="error().code"
      [urgent]="true"
      [icon]="icon()"
      [title]="'errors.' + error().code + '.title' | translate: error().params"
      [body]="'errors.' + error().code + '.body' | translate: error().params"
      [actionLabel]="retryable() ? ('common.retry' | translate) : undefined"
      (action)="retry.emit()"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBannerComponent {
  readonly error = input.required<ApiError>();
  readonly retryable = input(true);
  readonly retry = output<void>();

  protected readonly icon = computed<IconName>(() =>
    UNREACHABLE.includes(this.error().code) ? 'cloud_off' : 'error',
  );
}
