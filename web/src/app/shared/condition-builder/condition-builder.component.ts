import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DraftGroup } from '../../core/definition/draft';
import { DraftEdit, FocusTarget } from '../../core/definition/draft.edit';
import { IconComponent } from '../icon/icon.component';
import { BuilderView } from './builder-view';
import { ConditionGroupComponent } from './condition-group.component';

/**
 * The condition builder: one panel of the operating grey with the conditions and, once, at its foot, the
 * rule about missing values. Simple by default: a flat list of conditions and one switch (all of them, or
 * at least one). Groups and conditions on related records are behind one "advanced" action; a draft that
 * holds them is shown in full. It draws the draft it is given and emits
 * every edit; after an edit it moves the keyboard focus where `focus` says (a new row, or the row before a
 * removed one).
 */
@Component({
  selector: 'app-condition-builder',
  imports: [ConditionGroupComponent, IconComponent, TranslatePipe],
  template: `
    <div class="builder" data-testid="condition-builder">
      <app-condition-group
        [group]="draft()"
        [scope]="rootEntity()"
        [view]="view()"
        [root]="true"
        (edit)="edit.emit($event)"
        (advancedChange)="advancedChange.emit($event)"
      />
      <p class="note"><app-icon name="info" size="sm" />{{ 'editor.nullNote' | translate }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionBuilderComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly draft = input.required<DraftGroup>();
  readonly rootEntity = input.required<string>();
  readonly view = input.required<BuilderView>();
  /** Where the focus goes after the last edit; a new object each time, also for the same target. */
  readonly focus = input<FocusTarget | null>(null);
  readonly edit = output<DraftEdit>();
  /** The advanced actions were asked for, or put away. */
  readonly advancedChange = output<boolean>();

  constructor() {
    effect(() => {
      const target = this.focus();
      if (target) {
        afterNextRender(() => this.moveFocus(target), { injector: this.injector });
      }
    });
  }

  private moveFocus(target: FocusTarget): void {
    const root = this.host.nativeElement;
    if (!target.node) {
      root.querySelector<HTMLElement>(`[data-adder-of="${target.group}"]`)?.focus();
      return;
    }
    const row = root.querySelector<HTMLElement>(`[data-node="${target.node}"]`);
    // the input the caller named, else the first control of the row
    const within =
      (target.input && row?.querySelector<HTMLElement>(`[data-input~="${target.input}"]`)) ||
      row?.querySelector<HTMLElement>('[data-focus="first"]');
    const control = within?.matches('[tabindex], input, button')
      ? within
      : within?.querySelector<HTMLElement>('[tabindex], input, button');
    control?.focus();
  }
}
