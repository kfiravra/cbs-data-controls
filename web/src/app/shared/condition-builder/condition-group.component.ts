import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, output } from '@angular/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { GroupOp } from '../../core/definition/definition.types';
import { DraftGroup, DraftNode } from '../../core/definition/draft';
import { canAddCondition, canAddNested } from '../../core/definition/draft.check';
import { DraftEdit } from '../../core/definition/draft.edit';
import { relatedOptions } from '../../core/glossary/glossary.lookups';
import { joiningWord } from '../../core/glossary/glossary.phrases';
import { LanguageService } from '../../core/i18n/language.service';
import { IconComponent } from '../icon/icon.component';
import { BuilderView } from './builder-view';
import { ConditionRowComponent } from './condition-row.component';
import { RelatedNodeComponent } from './related-node.component';

/**
 * A group of conditions, recursive: a head that says how its rows combine (all of them, or at least one),
 * then its rows behind the rail with the joining word between neighbours, then the adders. Inside the
 * builder depth is a rail, never a box in a box. A `bare` group has no head of its own: the related-records
 * node carries it.
 */
@Component({
  selector: 'app-condition-group',
  imports: [
    ConditionRowComponent,
    IconComponent,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatTooltip,
    TranslatePipe,
    forwardRef(() => RelatedNodeComponent),
  ],
  templateUrl: './condition-group.component.html',
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
  `,
  host: { '[attr.data-group]': 'group().key', 'data-testid': 'condition-group' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionGroupComponent {
  private readonly language = inject(LanguageService);

  readonly group = input.required<DraftGroup>();
  /** The entity the rows of this group are about. */
  readonly scope = input<string>();
  readonly view = input.required<BuilderView>();
  /** The root group cannot be removed. */
  readonly root = input(false);
  readonly bare = input(false);
  readonly edit = output<DraftEdit>();
  readonly trace = output<string | null>();

  /** The word between two neighbours: the glossary's own, so it is the word the sentence uses. */
  protected readonly joiner = computed(() =>
    this.language.text(joiningWord(this.view().glossary, this.group().op)).trim(),
  );

  protected readonly canAdd = computed(() => canAddCondition(this.view().check));
  protected readonly canNest = computed(() => canAddNested(this.view().check, this.group().key));
  protected readonly hasRelated = computed(() => {
    const scope = this.scope();
    return scope !== undefined && relatedOptions(this.view().glossary, scope).length > 0;
  });

  protected nameOf(node: DraftNode): string {
    return node.type === 'group' ? node.key : node.id;
  }

  protected setOp(op: GroupOp): void {
    this.edit.emit({ kind: 'op', group: this.group().key, op });
  }

  protected add(kind: 'addCondition' | 'addGroup' | 'addRelated'): void {
    this.edit.emit({ kind, group: this.group().key });
  }
}
