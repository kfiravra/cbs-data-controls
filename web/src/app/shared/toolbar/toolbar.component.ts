import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormField, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { Subject, debounceTime } from 'rxjs';

import { IconComponent } from '../icon/icon.component';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * A strip of the operating grey over the table it controls: a search field, then the projected filters.
 * Below 640px the filters fold behind one square button. Texts arrive translated.
 */
@Component({
  selector: 'app-toolbar',
  imports: [IconComponent, MatFormField, MatInput, MatPrefix, MatTooltip],
  template: `
    <div class="toolbar" role="search">
      <mat-form-field class="toolbar__search" appearance="outline" subscriptSizing="dynamic">
        <app-icon matIconPrefix name="search" />
        <input
          matInput
          type="search"
          data-testid="toolbar-search"
          [attr.aria-label]="searchLabel()"
          [placeholder]="placeholder()"
          [value]="search()"
          (input)="typed.next($any($event.target).value)"
        />
      </mat-form-field>
      @if (filtersLabel(); as label) {
        <button
          class="icon-btn icon-btn--tonal only-narrow"
          type="button"
          data-testid="toolbar-filters-toggle"
          [attr.aria-label]="label"
          [matTooltip]="label"
          [attr.aria-expanded]="open()"
          (click)="open.set(!open())"
        >
          <app-icon name="tune" />
        </button>
        <div class="toolbar__filters" [class.is-open]="open()">
          <ng-content />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarComponent {
  readonly search = input('');
  readonly searchLabel = input.required<string>();
  readonly placeholder = input('');
  /** The name of the phone's filter button; leave it out for a toolbar with no filters. */
  readonly filtersLabel = input<string>();
  readonly searchChange = output<string>();

  protected readonly open = signal(false);
  protected readonly typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((text) => this.searchChange.emit(text));
  }
}
