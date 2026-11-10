import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { DraftCondition } from '../../core/definition/draft';
import { DraftEdit } from '../../core/definition/draft.edit';
import {
  comparableFields,
  fieldGroups,
  findOperator,
  operatorsOf,
  resolveField,
} from '../../core/glossary/glossary.lookups';
import { FieldPickerComponent } from '../field-picker/field-picker.component';
import { IconComponent } from '../icon/icon.component';
import { MarkComponent, MarkState } from '../mark/mark.component';
import { OperatorPickerComponent } from '../operator-picker/operator-picker.component';
import { OperandFault, ValueInputComponent } from '../value-input/value-input.component';
import { BuilderView } from './builder-view';

/**
 * One condition: its mark, a field, a comparison, a value, and remove. It is one line when its group is at
 * least 560px wide and stacks below that (the container query of the builder stylesheet). The row edits
 * nothing: it emits what the user asked for.
 */
@Component({
  selector: 'app-condition-row',
  imports: [
    FieldPickerComponent,
    IconComponent,
    MarkComponent,
    MatTooltip,
    OperatorPickerComponent,
    TranslatePipe,
    ValueInputComponent,
  ],
  templateUrl: './condition-row.component.html',
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
  `,
  host: {
    '[attr.data-node]': 'condition().id',
    'data-testid': 'condition-row',
    '(focusin)': 'trace.emit(condition().id)',
    '(focusout)': 'trace.emit(null)',
    '(pointerenter)': 'trace.emit(condition().id)',
    '(pointerleave)': 'trace.emit(null)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionRowComponent {
  readonly condition = input.required<DraftCondition>();
  /** The entity the row's fields are read from: the root entity, or the related entity inside a related node. */
  readonly scope = input<string>();
  readonly view = input.required<BuilderView>();
  readonly edit = output<DraftEdit>();
  readonly trace = output<string | null>();

  /** The glossary alone: tracing a row changes the view on every hover, and must not rebuild every list. */
  private readonly glossary = computed(() => this.view().glossary);

  protected readonly mark = computed(() => this.view().marks.get(this.condition().id) ?? '');
  protected readonly messages = computed(() => this.view().messages.get(this.condition().id) ?? []);
  protected readonly faults = computed<OperandFault[]>(() =>
    this.messages().flatMap((message) => (message.input ? [{ input: message.input, index: message.index }] : [])),
  );

  protected readonly markState = computed<MarkState>(() => {
    const id = this.condition().id;
    if (this.view().check.issues.has(id) || this.messages().length > 0) {
      return 'open';
    }
    return this.view().traced === id ? 'traced' : 'resting';
  });

  protected readonly groups = computed(() => {
    const scope = this.scope();
    return scope ? fieldGroups(this.glossary(), scope) : [];
  });

  protected readonly field = computed(() => {
    const scope = this.scope();
    const left = this.condition().left;
    return scope && left ? resolveField(this.glossary(), scope, left)?.field : undefined;
  });

  protected readonly operators = computed(() => {
    const field = this.field();
    return field ? operatorsOf(this.glossary(), field) : [];
  });

  protected readonly arity = computed(() => {
    const operator = this.condition().operator;
    return operator ? findOperator(this.glossary(), operator)?.arity : undefined;
  });

  protected readonly comparable = computed(() => {
    const { left, operator } = this.condition();
    const scope = this.scope();
    return scope && left && operator ? comparableFields(this.glossary(), scope, left, operator) : [];
  });

  protected hasFault(input: 'left' | 'operator'): boolean {
    return this.faults().some((fault) => fault.input === input);
  }

  protected emit(edit: DraftEdit): void {
    this.edit.emit(edit);
  }
}
