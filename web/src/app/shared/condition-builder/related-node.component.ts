import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, output } from '@angular/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { DraftRelated } from '../../core/definition/draft';
import { toneOf } from '../../core/definition/marks';
import { DraftEdit } from '../../core/definition/draft.edit';
import { findRelationship, relatedOptions } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';
import { IconComponent } from '../icon/icon.component';
import { InvalidDirective } from '../invalid/invalid.directive';
import { MarkComponent, MarkState } from '../mark/mark.component';
import { BuilderView } from './builder-view';
import { ConditionGroupComponent } from './condition-group.component';

/**
 * A condition on related records. Its head reads as the start of a sentence: its mark, a quantity (none, or
 * at least one), the relationship, and how its own conditions combine. Its rows are about the related
 * entity. A run matches the node as a whole, so the node carries its own mark and its rows continue the
 * sequence.
 */
@Component({
  selector: 'app-related-node',
  imports: [
    IconComponent,
    InvalidDirective,
    MarkComponent,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatFormField,
    MatOption,
    MatSelect,
    MatTooltip,
    TranslatePipe,
    forwardRef(() => ConditionGroupComponent),
  ],
  templateUrl: './related-node.component.html',
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
  `,
  host: {
    '[attr.data-node]': 'node().id',
    'data-testid': 'related-node',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedNodeComponent {
  protected readonly language = inject(LanguageService);

  readonly node = input.required<DraftRelated>();
  /** The entity the node counts related records of. */
  readonly scope = input<string>();
  readonly view = input.required<BuilderView>();
  readonly edit = output<DraftEdit>();

  protected readonly mark = computed(() => this.view().marks.get(this.node().id) ?? '');
  protected readonly tone = computed(() => toneOf(this.view().marks, this.node().id));
  protected readonly messages = computed(() => this.view().messages.get(this.node().id) ?? []);
  protected readonly invalid = computed(() => this.messages().some((message) => message.input === 'relationship'));

  protected readonly markState = computed<MarkState>(() => {
    const id = this.node().id;
    return this.view().check.issues.has(id) || this.messages().length > 0 ? 'open' : 'resting';
  });

  protected readonly options = computed(() => {
    const scope = this.scope();
    return scope ? relatedOptions(this.view().glossary, scope) : [];
  });

  /** The entity the node's own conditions are about. */
  protected readonly relatedEntity = computed(() => {
    const key = this.node().relationship;
    return key ? findRelationship(this.view().glossary, key)?.to : undefined;
  });

  protected emit(edit: DraftEdit): void {
    this.edit.emit(edit);
  }
}
