import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';

import { GlossaryEntity } from '../../core/api/api.types';
import { LanguageService } from '../../core/i18n/language.service';
import { IconComponent } from '../icon/icon.component';

/**
 * What a control checks, as a choice: one card for each entity the glossary allows, with its name and the
 * glossary's own description of it. One radio group: arrow keys move the choice, and the chosen card (the
 * first, while nothing is chosen) is the one tab stop. It assumes no number of entities.
 */
@Component({
  selector: 'app-entity-cards',
  imports: [IconComponent],
  template: `
    <div
      class="choices"
      role="radiogroup"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="describedBy() ?? null"
      [attr.aria-invalid]="invalid() ? 'true' : null"
    >
      @for (entity of entities(); track entity.key; let first = $first) {
        <button
          class="choice"
          type="button"
          role="radio"
          data-testid="root-entity"
          [attr.data-key]="entity.key"
          [attr.aria-checked]="entity.key === chosen()"
          [attr.tabindex]="entity.key === chosen() || (chosen() === null && first) ? 0 : -1"
          (click)="choose.emit(entity.key)"
          (keydown)="onKey($event)"
        >
          <span class="choice__name">
            {{ language.text(entity.label.plural) }}
            <app-icon class="choice__check" name="check_circle" />
          </span>
          <span class="choice__about">{{ language.text(entity.description) }}</span>
        </button>
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
export class EntityCardsComponent {
  protected readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly entities = input.required<readonly GlossaryEntity[]>();
  /** The key of the chosen entity; null while nothing is chosen. */
  readonly chosen = input.required<string | null>();
  /** The id of the heading that asks the question. */
  readonly labelledBy = input.required<string>();
  /** The id of the error that says a choice is missing, while it stands. */
  readonly describedBy = input<string | null>(null);
  readonly invalid = input(false);
  readonly choose = output<string>();

  /** The first card: where the focus goes when a save found nothing chosen. */
  focus(): void {
    this.cards()[0]?.focus();
  }

  private cards(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]')];
  }

  /** Next and previous follow the reading direction: in a right-to-left page the left arrow goes forward. */
  protected onKey(event: KeyboardEvent): void {
    const forward = this.language.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = this.language.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step = [forward, 'ArrowDown'].includes(event.key) ? 1 : [back, 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const entities = this.entities();
    const current = entities.findIndex((entity) => entity.key === this.chosen());
    // from no choice, forward lands on the first card and back on the last
    const next = current === -1 ? (step === 1 ? 0 : entities.length - 1) : (current + step + entities.length) % entities.length;
    this.choose.emit(entities[next].key);
    this.cards()[next]?.focus();
  }
}
