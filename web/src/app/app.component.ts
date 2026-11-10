import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** The frame of every screen: the bar with the brand, and the page container. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, TranslatePipe],
  template: `
    <header class="appbar">
      <div class="appbar__in">
        <a class="brand" routerLink="/" data-testid="brand">
          <svg class="brand__mark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <circle cx="17.5" cy="6.5" r="4.5" />
            <circle cx="6.5" cy="17.5" r="4.5" />
            <rect x="13" y="13" width="9" height="9" rx="1.5" />
          </svg>
          {{ 'app.name' | translate }}
        </a>
      </div>
    </header>
    <main class="page">
      <router-outlet />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
