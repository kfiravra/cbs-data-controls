import { signal } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';

import { SuggestionItem } from '../../core/api/api.types';
import { SuggestionsApi } from '../../core/api/suggestions.api';

/** How many suggestions a new control is offered for what it checks. */
export const IDEAS_MAX = 3;

/**
 * Suggestions for what a new control checks: the engine's drafts for that entity, computed from the data as
 * they are now. Held by the editor's store. Not knowing them is no failure of the editor: an engine that
 * does not answer leaves the list empty.
 */
export class EditorIdeas {
  readonly items = signal<readonly SuggestionItem[]>([]);
  /** The suggestions are on their way: their place is held, so the conditions do not move when they arrive. */
  readonly loading = signal(false);
  /** The entity the last question was about; null once the question no longer matters. */
  private asked: string | null = null;

  constructor(private readonly api: SuggestionsApi) {}

  /** Puts a list back (the undo of a changed choice), or empties it. An answer on its way is dropped. */
  set(items: readonly SuggestionItem[] = []): void {
    this.asked = null;
    this.items.set(items);
    this.loading.set(false);
  }

  /**
   * Puts back the list of a draft that was closed. A draft that was closed with none (they were on their
   * way, or there were none) asks again about its entity, when it is one that is offered suggestions.
   */
  resume(items: readonly SuggestionItem[], rootEntity: string | null): void {
    this.set(items);
    if (items.length === 0 && rootEntity !== null) {
      void this.read(rootEntity);
    }
  }

  /** Asks the engine what it would check about an entity. Only the answer to the last question is kept. */
  async read(rootEntity: string): Promise<void> {
    this.asked = rootEntity;
    this.items.set([]);
    this.loading.set(true);
    // the suggestions are an offer: an engine that does not answer offers none, and the editor stands
    const none: readonly SuggestionItem[] = [];
    const items = await firstValueFrom(
      this.api.request({ rootEntity, max: IDEAS_MAX }).pipe(
        map((answer) => answer.items),
        catchError(() => of(none)),
      ),
    );
    if (this.asked === rootEntity) {
      this.set(items.slice(0, IDEAS_MAX));
    }
  }
}
