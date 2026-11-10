import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { StatePanelComponent } from '../state-panel/state-panel.component';

/** What an unknown address, a missing control and a missing run all show: where the user can go from here. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, StatePanelComponent, TranslatePipe],
  template: `
    <app-state-panel icon="link_off" [title]="'states.notFound.title' | translate" data-testid="not-found">
      <p>{{ 'states.notFound.body' | translate }}</p>
      <a actions class="btn btn--tonal" routerLink="/">{{ 'states.notFound.toList' | translate }}</a>
    </app-state-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
