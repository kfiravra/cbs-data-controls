import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  MatChipGrid,
  MatChipInput,
  MatChipInputEvent,
  MatChipRemove,
  MatChipRow,
} from '@angular/material/chips';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { Arity, GlossaryField } from '../../core/api/api.types';
import { FieldRef, ListValue, Scalar } from '../../core/definition/definition.types';
import { DraftCondition, OperandMode } from '../../core/definition/draft';
import { NodeInput } from '../../core/definition/draft.check';
import { FieldGroup } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';
import { FieldPickerComponent } from '../field-picker/field-picker.component';
import { IconComponent } from '../icon/icon.component';

/** Which input of the operand is wrong: the whole operand, or one end of a range. */
export interface OperandFault {
  readonly input: NodeInput;
  readonly index?: number;
}

type Kind = 'none' | 'field' | 'choice' | 'choices' | 'chips' | 'range' | 'single' | 'idle';

/**
 * The operand of a condition, by the field's type and the operator's arity: a number with its unit, text, a
 * date, a choice of the glossary's values, two ends of a range, a list of values, "no value needed", or
 * another field when the comparison toggle is on. It edits nothing itself: every change is emitted.
 */
@Component({
  selector: 'app-value-input',
  imports: [
    FieldPickerComponent,
    IconComponent,
    MatChipGrid,
    MatChipInput,
    MatChipRemove,
    MatChipRow,
    MatFormField,
    MatInput,
    MatOption,
    MatSelect,
    MatSuffix,
    MatTooltip,
    TranslatePipe,
  ],
  templateUrl: './value-input.component.html',
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValueInputComponent {
  protected readonly language = inject(LanguageService);
  protected readonly separators = [ENTER, COMMA];

  readonly condition = input.required<DraftCondition>();
  /** The left field; undefined until one is chosen, or when the glossary no longer has it. */
  readonly field = input<GlossaryField>();
  readonly arity = input<Arity>();
  /** The fields the row may be compared with; empty when the comparison toggle is not offered. */
  readonly comparable = input<readonly FieldGroup[]>([]);
  readonly faults = input<readonly OperandFault[]>([]);
  /** The words that name the row for assistive technology ("condition B"). */
  readonly rowName = input.required<string>();

  readonly valueChange = output<Scalar | undefined>();
  readonly valuesChange = output<readonly ListValue[]>();
  readonly rightChange = output<FieldRef>();
  readonly modeChange = output<OperandMode>();

  protected readonly kind = computed<Kind>(() => {
    const arity = this.arity();
    const type = this.field()?.type;
    if (arity === undefined || type === undefined) {
      return 'idle';
    }
    if (arity === 0) {
      return 'none';
    }
    if (arity === 1 && this.condition().mode === 'field') {
      return 'field';
    }
    if (arity === 2) {
      return 'range';
    }
    if (arity === 'list') {
      return type === 'enum' ? 'choices' : 'chips';
    }
    return type === 'enum' || type === 'bool' ? 'choice' : 'single';
  });

  protected readonly inputType = computed(() => (this.field()?.type === 'date' ? 'date' : 'text'));
  protected readonly inputMode = computed(() => (this.field()?.type === 'number' ? 'decimal' : null));
  protected readonly unit = computed(() => this.language.text(this.field()?.unit));

  /** The glossary's values of an enum or a boolean field, with their labels. */
  protected readonly choices = computed<{ value: Scalar; label: string }[]>(() => {
    const field = this.field();
    if (field?.type === 'bool') {
      return [true, false].map((value) => ({
        value,
        label: this.language.text(field.valueLabels?.[value ? 'true' : 'false']),
      }));
    }
    return (field?.enumValues ?? []).map((entry) => ({ value: entry.value, label: this.language.text(entry.label) }));
  });

  protected readonly values = computed(() => this.condition().values ?? []);
  protected readonly canCompare = computed(() => this.arity() === 1 && this.comparable().length > 0);

  protected invalid(input: NodeInput, index?: number): boolean {
    return this.faults().some(
      (fault) => fault.input === input && (fault.index === undefined || index === undefined || fault.index === index),
    );
  }

  protected text(value: Scalar | undefined): string {
    return value === undefined ? '' : String(value);
  }

  protected typed(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.valueChange.emit(text === '' ? undefined : text);
  }

  protected typedEnd(index: 0 | 1, event: Event): void {
    const ends: ListValue[] = [this.values()[0] ?? '', this.values()[1] ?? ''];
    ends[index] = (event.target as HTMLInputElement).value;
    this.valuesChange.emit(ends);
  }

  protected addChip(event: MatChipInputEvent): void {
    const text = event.value.trim();
    if (text !== '' && !this.values().some((value) => String(value) === text)) {
      this.valuesChange.emit([...this.values(), text]);
    }
    event.chipInput.clear();
  }

  protected removeChip(value: ListValue): void {
    this.valuesChange.emit(this.values().filter((candidate) => candidate !== value));
  }

  protected toggleMode(): void {
    this.modeChange.emit(this.condition().mode === 'field' ? 'value' : 'field');
  }
}
