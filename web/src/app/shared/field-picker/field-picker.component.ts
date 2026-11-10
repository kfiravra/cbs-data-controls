import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatOptgroup, MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { FieldRef } from '../../core/definition/definition.types';
import { GlossaryLabelsService } from '../../core/glossary/glossary-labels.service';
import { FieldGroup } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';

interface FieldOption {
  readonly key: string;
  readonly label: string;
  readonly ref: FieldRef;
  /** The path before the field, shown when the field belongs to a related entity. */
  readonly pathLabel: string | null;
}

const keyOf = (ref: FieldRef) => `${(ref.path ?? []).join('>')}|${ref.field}`;

/**
 * Picks a field from the glossary: the scope's own fields, then the fields reached through its
 * relationships, grouped by entity and relationship label. A reference the glossary no longer has is shown
 * as "no longer available", never as its key.
 */
@Component({
  selector: 'app-field-picker',
  imports: [MatFormField, MatOptgroup, MatOption, MatSelect, MatSelectTrigger, TranslatePipe],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" [class.field--invalid]="invalid()">
      <mat-select
        [attr.data-testid]="testId()"
        [attr.aria-invalid]="invalid()"
        [aria-label]="label()"
        [placeholder]="'editor.field.placeholder' | translate"
        [value]="selectedKey()"
        (selectionChange)="choose($event.value)"
      >
        <mat-select-trigger>
          @if (selected(); as chosen) {
            @if (chosen.pathLabel) {
              <span class="field__path">{{ chosen.pathLabel }}</span>
            }
            <span>{{ chosen.label }}</span>
          } @else {
            {{ 'editor.field.gone' | translate }}
          }
        </mat-select-trigger>
        @for (group of options(); track group.label) {
          <mat-optgroup [label]="group.label">
            @for (option of group.fields; track option.key) {
              <mat-option [value]="option.key">{{ option.label }}</mat-option>
            }
          </mat-optgroup>
        }
        @if (goneKey(); as key) {
          <mat-option [value]="key" [disabled]="true">{{ 'editor.field.gone' | translate }}</mat-option>
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
export class FieldPickerComponent {
  private readonly language = inject(LanguageService);
  private readonly labels = inject(GlossaryLabelsService);

  readonly groups = input.required<readonly FieldGroup[]>();
  readonly value = input<FieldRef>();
  /** The accessible name: what the field is for in its row. */
  readonly label = input.required<string>();
  readonly invalid = input(false);
  readonly testId = input('field-picker');
  readonly pick = output<FieldRef>();

  protected readonly options = computed(() =>
    this.groups().map((group) => {
      const label = this.labels.groupLabel(group);
      return {
        label,
        fields: group.fields.map<FieldOption>((field) => {
          const ref: FieldRef = group.path.length > 0 ? { path: group.path, field: field.key } : { field: field.key };
          return {
            key: keyOf(ref),
            label: this.language.text(field.label),
            ref,
            pathLabel: group.path.length > 0 ? label : null,
          };
        }),
      };
    }),
  );

  private readonly byKey = computed(
    () => new Map(this.options().flatMap((group) => group.fields.map((option) => [option.key, option] as const))),
  );

  protected readonly selectedKey = computed(() => {
    const value = this.value();
    return value ? keyOf(value) : null;
  });

  protected readonly selected = computed(() => this.byKey().get(this.selectedKey() ?? '') ?? null);

  /** The key of a chosen reference the glossary no longer offers. */
  protected readonly goneKey = computed(() => {
    const key = this.selectedKey();
    return key !== null && !this.byKey().has(key) ? key : null;
  });

  protected choose(key: string): void {
    const option = this.byKey().get(key);
    if (option) {
      this.pick.emit(option.ref);
    }
  }
}
