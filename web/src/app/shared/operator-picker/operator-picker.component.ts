import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { FieldType, GlossaryOperator } from '../../core/api/api.types';
import { operatorLabel } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * Picks a comparison. The list holds only what the glossary allows for the field, each under the label
 * variant that fits the field's type and whether the row compares with another field.
 */
@Component({
  selector: 'app-operator-picker',
  imports: [MatFormField, MatOption, MatSelect, TranslatePipe],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" [class.field--invalid]="invalid()">
      <mat-select
        data-testid="operator-picker"
        [attr.aria-invalid]="invalid()"
        [aria-label]="'editor.operator.label' | translate"
        [placeholder]="'editor.operator.placeholder' | translate"
        [disabled]="options().length === 0"
        [value]="value() ?? null"
        (selectionChange)="pick.emit($event.value)"
      >
        @for (option of options(); track option.key) {
          <mat-option [value]="option.key">{{ option.label }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorPickerComponent {
  private readonly language = inject(LanguageService);

  readonly operators = input.required<readonly GlossaryOperator[]>();
  readonly fieldType = input<FieldType>();
  readonly rightIsField = input(false);
  readonly value = input<string>();
  readonly invalid = input(false);
  readonly pick = output<string>();

  protected readonly options = computed(() => {
    const type = this.fieldType();
    if (!type) {
      return [];
    }
    return this.operators().map((operator) => ({
      key: operator.key,
      label: this.language.text(operatorLabel(operator, type, this.rightIsField())),
    }));
  });
}
