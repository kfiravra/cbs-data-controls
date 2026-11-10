import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeadComponent } from '../../shared/page-head/page-head.component';

@Component({
  selector: 'app-controls-list-page',
  imports: [PageHeadComponent, TranslatePipe],
  template: `<app-page-head [title]="'list.title' | translate" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsListPage {}
