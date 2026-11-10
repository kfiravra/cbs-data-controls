import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EntityMap } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * The root entity picker: the entities the glossary allows as a root as one radio group, joined by the
 * relationships between neighbours. It is drawn from the glossary and assumes no number of entities.
 * Arrow keys move the choice, as in any radio group; the chosen entity is the one tab stop.
 */
@Component({
  selector: 'app-relationship-map',
  imports: [TranslatePipe],
  template: `
    <div class="relmap" role="radiogroup" [attr.aria-labelledby]="labelledBy()">
      @for (entry of map().entities; track entry.entity.key; let index = $index; let last = $last) {
        <button
          class="entity"
          type="button"
          role="radio"
          data-testid="root-entity"
          [attr.aria-checked]="entry.selected"
          [attr.tabindex]="entry.selected ? 0 : -1"
          (click)="choose.emit(entry.entity.key)"
          (keydown)="onKey($event)"
        >
          {{ language.text(entry.entity.label.plural) }}
          @if (entry.selected) {
            <span class="entity__role">{{ 'editor.root.role' | translate }}</span>
          }
        </button>
        @if (!last) {
          <span class="relmap__link" [class.relmap__link--none]="!map().links[index]">
            @if (map().links[index]; as link) {
              <span>{{ language.text(link.label) }}</span>
            }
          </span>
        }
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
export class RelationshipMapComponent {
  protected readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly map = input.required<EntityMap>();
  /** The id of the heading that names the group. */
  readonly labelledBy = input.required<string>();
  readonly choose = output<string>();

  /** Next and previous follow the reading direction: in a right-to-left page the left arrow goes forward. */
  protected onKey(event: KeyboardEvent): void {
    const forward = this.language.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = this.language.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step = [forward, 'ArrowDown'].includes(event.key) ? 1 : [back, 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const entities = this.map().entities;
    const current = entities.findIndex((entry) => entry.selected);
    const next = (current + step + entities.length) % entities.length;
    this.choose.emit(entities[next].entity.key);
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
}
