import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';

import { GlossaryEntity } from '../../core/api/api.types';
import { LanguageService } from '../../core/i18n/language.service';
import { IconComponent } from '../icon/icon.component';

/**
 * What a control checks, as a choice: one card for each entity the glossary allows, with its name and the
 * glossary's own description of it. One radio group with one tab stop: the chosen card, or the first while
 * nothing is chosen. Arrow keys move between the cards and choose nothing; Space, Enter or a click chooses.
 * Another choice starts a control's conditions over, so it is never made by passing over a card. It assumes
 * no number of entities.
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
      (focusout)="onFocusOut($event)"
    >
      @for (entity of entities(); track entity.key; let first = $first) {
        <button
          class="choice"
          type="button"
          role="radio"
          data-testid="root-entity"
          [attr.data-key]="entity.key"
          [attr.aria-checked]="entity.key === chosen()"
          [attr.tabindex]="entity.key === (walked() ?? chosen() ?? (first ? entity.key : null)) ? 0 : -1"
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

  /** The card the arrow keys stand on while they move through the group; null once the focus has left it. */
  protected readonly walked = signal<string | null>(null);

  /** The first card: where the focus goes when a save found nothing chosen. */
  focus(): void {
    this.cards()[0]?.focus();
  }

  private cards(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]')];
  }

  /**
   * The arrows move the focus to the next or the previous card, round the ends, and choose nothing. Next and
   * previous follow the reading direction: in a right-to-left page the left arrow goes forward.
   */
  protected onKey(event: KeyboardEvent): void {
    const forward = this.language.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = this.language.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step = [forward, 'ArrowDown'].includes(event.key) ? 1 : [back, 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const cards = this.cards();
    const current = cards.indexOf(event.currentTarget as HTMLElement);
    const next = (current + step + cards.length) % cards.length;
    this.walked.set(this.entities()[next].key);
    cards[next]?.focus();
  }

  /** Once the focus is out of the group, its one tab stop is the chosen card again. */
  protected onFocusOut(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.walked.set(null);
    }
  }
}
