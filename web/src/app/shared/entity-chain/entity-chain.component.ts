import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EntityChain } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * How the things a control may check connect: each entity in glossary order, and between two neighbours a
 * line that says which holds many of the other. A picture to read, not a control: nothing in it can be
 * pressed. It is drawn from the glossary and assumes no number of entities.
 */
@Component({
  selector: 'app-entity-chain',
  imports: [TranslatePipe],
  template: `
    <div class="chain-wrap" data-testid="entity-chain">
      <span id="chain-label">{{ 'editor.what.chain' | translate }}</span>
      <ol class="chain" aria-labelledby="chain-label">
        @for (entry of chain().entities; track entry.entity.key; let index = $index; let last = $last) {
          <li class="chain__node" data-testid="chain-node" [class.is-chosen]="entry.selected">
            {{ language.text(entry.entity.label.plural) }}
          </li>
          @if (!last) {
            <li class="chain__link" data-testid="chain-link" [class.chain__link--bare]="!chain().links[index]">
              @if (chain().links[index]; as link) {
                <span>{{
                  'editor.what.link'
                    | translate
                      : { one: language.text(link.one.label.singular), many: language.text(link.many.label.plural) }
                }}</span>
              }
            </li>
          }
        }
      </ol>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityChainComponent {
  protected readonly language = inject(LanguageService);

  readonly chain = input.required<EntityChain>();
}
