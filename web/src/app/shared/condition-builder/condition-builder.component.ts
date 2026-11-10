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
 * The condition builder: one panel of the operating grey with the tree of groups, rows and related-records
 * nodes, and once, at its foot, the rule about missing values. It draws the draft it is given and emits
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
        (trace)="trace.emit($event)"
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
  readonly trace = output<string | null>();

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
    const element = target.node
      ? root.querySelector<HTMLElement>(`[data-node="${target.node}"] [data-focus="first"] [tabindex], [data-node="${target.node}"] [data-focus="first"][tabindex]`)
      : root.querySelector<HTMLElement>(`[data-group="${target.group}"] > .group > .group__body > .adders > [data-adder]`);
    element?.focus();
  }
}
