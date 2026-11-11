import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { TranslatePipe } from '@ngx-translate/core';

import { SuggestionItem } from '../../core/api/api.types';
import { MarksService } from '../../core/definition/marks.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { TextPartsComponent } from '../../shared/text-parts/text-parts.component';

/**
 * One suggested control, as a card: a checkbox with its name, the rule in words with a mark per clause, why
 * the engine proposes it, the evidence from the data as chips, and a way to open it in the editor. Its
 * texts arrive rendered by the engine.
 */
@Component({
  selector: 'app-suggestion-card',
  imports: [IconComponent, MatCheckbox, TextPartsComponent, TranslatePipe],
  template: `
    <article class="suggestion" data-testid="suggestion" [class.is-chosen]="selected()">
      <div class="suggestion__head">
        <mat-checkbox
          data-testid="suggestion-check"
          [checked]="selected()"
          [aria-label]="'suggestions.select' | translate: { name: item().name }"
          (change)="selectedChange.emit($event.checked)"
        />
        <h3 class="suggestion__name" data-testid="suggestion-name"><bdi>{{ item().name }}</bdi></h3>
      </div>
      <p class="sentence sentence--body" data-testid="suggestion-sentence">
        <app-text-parts [parts]="item().sentenceParts" [marks]="marks()" />
      </p>
      <p class="suggestion__why">{{ item().rationale }}</p>
      <ul class="evidence" [attr.aria-label]="'suggestions.evidence' | translate">
        @for (evidence of item().evidence; track evidence.key) {
          <li class="chip num" data-testid="evidence">{{ evidence.text }}</li>
        }
      </ul>
      @if (failed()) {
        <p class="field__error" role="alert" data-testid="suggestion-error">
          <app-icon name="error" size="sm" />{{ 'suggestions.invalid' | translate }}
        </p>
      }
      <button
        class="btn btn--text btn--sm suggestion__open"
        type="button"
        data-testid="suggestion-edit"
        [attr.aria-label]="'suggestions.openNamed' | translate: { name: item().name }"
        (click)="edit.emit()"
      >
        {{ 'suggestions.openInEditor' | translate }}
      </button>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionCardComponent {
  private readonly marksService = inject(MarksService);

  readonly item = input.required<SuggestionItem>();
  readonly selected = input(false);
  /** The server refused this draft when the selection was created. */
  readonly failed = input(false);
  readonly selectedChange = output<boolean>();
  readonly edit = output<void>();

  protected readonly marks = computed(() => this.marksService.of(this.item().definition.where));
}
