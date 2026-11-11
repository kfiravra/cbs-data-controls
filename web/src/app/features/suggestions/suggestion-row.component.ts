import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { TranslatePipe } from '@ngx-translate/core';

import { SuggestionItem } from '../../core/api/api.types';
import { MarksService } from '../../core/definition/marks.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { TextPartsComponent } from '../../shared/text-parts/text-parts.component';

/**
 * One suggested control: a checkbox, its name, its sentence with a mark per clause, why the engine proposes
 * it, the evidence as chips, and a way to open it in the editor. Its texts arrive rendered by the engine.
 */
@Component({
  selector: 'app-suggestion-row',
  imports: [IconComponent, MatCheckbox, TextPartsComponent, TranslatePipe],
  template: `
    <div class="suggestion" data-testid="suggestion">
      <mat-checkbox
        class="suggestion__check"
        data-testid="suggestion-check"
        [checked]="selected()"
        [aria-label]="'suggestions.select' | translate: { name: item().name }"
        (change)="selectedChange.emit($event.checked)"
      />
      <span class="cell-title" data-testid="suggestion-name"><bdi>{{ item().name }}</bdi></span>
      <p class="sentence sentence--body" data-testid="suggestion-sentence">
        <app-text-parts [parts]="item().sentenceParts" [marks]="marks()" />
      </p>
      <span class="cell-desc">{{ item().rationale }}</span>
      <span class="evidence">
        @for (evidence of item().evidence; track evidence.key) {
          <span class="chip num" data-testid="evidence">{{ evidence.text }}</span>
        }
        <button
          class="btn btn--text btn--sm"
          type="button"
          data-testid="suggestion-edit"
          [attr.aria-label]="'suggestions.openNamed' | translate: { name: item().name }"
          (click)="edit.emit()"
        >
          {{ 'suggestions.openInEditor' | translate }}
        </button>
      </span>
      @if (failed()) {
        <p class="field__error" role="alert" data-testid="suggestion-error">
          <app-icon name="error" size="sm" />{{ 'suggestions.invalid' | translate }}
        </p>
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
export class SuggestionRowComponent {
  private readonly marksService = inject(MarksService);

  readonly item = input.required<SuggestionItem>();
  readonly selected = input(false);
  /** The server refused this draft when the selection was created. */
  readonly failed = input(false);
  readonly selectedChange = output<boolean>();
  readonly edit = output<void>();

  protected readonly marks = computed(() => this.marksService.of(this.item().definition.where));
}
