import { Injectable, signal } from '@angular/core';

/**
 * Word to the list that a control changed where the list could not see it: a save or a run that landed
 * after its panel was closed. The list reads itself again when its panel closes or moves on; this covers
 * the answer that arrives later than that. A screen in the panel says so through this service, so it does
 * not reach for the list's own store.
 */
@Injectable({ providedIn: 'root' })
export class ListChanges {
  private readonly count = signal(0);

  /** How many changes were reported; the list reads itself again when it grows. */
  readonly reported = this.count.asReadonly();

  report(): void {
    this.count.update((count) => count + 1);
  }
}
