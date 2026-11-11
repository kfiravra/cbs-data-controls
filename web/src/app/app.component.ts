import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** The frame of the page: the bar with the name, which is the mark, and the page container. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, TranslatePipe],
  template: `
    <header class="appbar">
      <div class="appbar__in">
        <a class="brand" routerLink="/" data-testid="brand">{{ 'app.name' | translate }}</a>
      </div>
    </header>
    <main class="page">
      <router-outlet />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
