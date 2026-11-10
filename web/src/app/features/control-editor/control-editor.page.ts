import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeadComponent } from '../../shared/page-head/page-head.component';

@Component({
  selector: 'app-control-editor-page',
  imports: [PageHeadComponent, TranslatePipe],
  template: `
    <app-page-head [title]="(id() ? 'editor.titleEdit' : 'editor.titleNew') | translate" [back]="true" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlEditorPage {
  /** The control's id from the route; absent for a new control. */
  readonly id = input<string>();
}
