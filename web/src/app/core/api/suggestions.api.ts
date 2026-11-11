import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api-error';
import { AcceptAnswer, ControlDraftBody, SuggestionsAnswer } from './api.types';

@Injectable({ providedIn: 'root' })
export class SuggestionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/suggestions`;

  /**
   * Drafts the engine proposes from the glossary and the data as they are now. Nothing is stored or run.
   * `rootEntity` keeps the drafts about one entity; `max` is how many are wanted at most.
   */
  request(only: { readonly rootEntity?: string; readonly max?: number } = {}): Observable<SuggestionsAnswer> {
    return this.http.post<SuggestionsAnswer>(this.base, only);
  }

  /** Creates the chosen drafts as controls: all of them or none. */
  accept(items: readonly ControlDraftBody[]): Observable<AcceptAnswer> {
    return this.http.post<AcceptAnswer>(`${this.base}/accept`, { items });
  }
}
