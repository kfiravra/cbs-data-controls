import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeadComponent } from '../../shared/page-head/page-head.component';

@Component({
  selector: 'app-run-results-page',
  imports: [PageHeadComponent, TranslatePipe],
  template: `<app-page-head [title]="'results.title' | translate" [back]="true" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunResultsPage {
  /** The run's id from the route. */
  readonly id = input.required<string>();
}
