import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiError, toApiError } from '../api/api-error';
import { Glossary } from '../api/api.types';
import { GlossaryApi } from '../api/glossary.api';

interface GlossaryState {
  readonly glossary: Glossary | null;
  readonly error: ApiError | null;
}

/**
 * The glossary, read once and kept for the session. A failed load leaves stored text readable (a label
 * falls back to a dash) and is shown as the engine banner; `load` may then be tried again.
 */
@Injectable({ providedIn: 'root' })
export class GlossaryService {
  private readonly api = inject(GlossaryApi);
  private readonly state = signal<GlossaryState>({ glossary: null, error: null });
  private pending: Promise<Glossary | null> | null = null;

  readonly glossary = computed(() => this.state().glossary);
  readonly error = computed(() => this.state().error);

  /** The glossary, from the cache when it is there; null when the load failed. */
  load(): Promise<Glossary | null> {
    const cached = this.state().glossary;
    if (cached) {
      return Promise.resolve(cached);
    }
    this.pending ??= firstValueFrom(this.api.get())
      .then((glossary) => {
        this.state.set({ glossary, error: null });
        return glossary;
      })
      .catch((error: unknown) => {
        this.state.set({ glossary: null, error: toApiError(error) });
        return null;
      })
      .finally(() => (this.pending = null));
    return this.pending;
  }
}
