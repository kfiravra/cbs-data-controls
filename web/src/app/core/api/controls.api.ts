import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api-error';
import {
  Control,
  ControlDraftBody,
  ControlSummary,
  ControlUpdateBody,
  ControlVersion,
  ControlsQuery,
  Definition,
  Page,
  ValidateAnswer,
} from './api.types';
import { queryParams } from './params';

@Injectable({ providedIn: 'root' })
export class ControlsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/controls`;

  list(query: ControlsQuery): Observable<Page<ControlSummary>> {
    return this.http.get<Page<ControlSummary>>(this.base, { params: queryParams(query) });
  }

  get(id: number): Observable<Control> {
    return this.http.get<Control>(`${this.base}/${id}`);
  }

  create(body: ControlDraftBody): Observable<Control> {
    return this.http.post<Control>(this.base, body);
  }

  update(id: number, body: ControlUpdateBody): Observable<Control> {
    return this.http.put<Control>(`${this.base}/${id}`, body);
  }

  /** Archives the control; there is no un-archive. */
  archive(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** A dry compile: the rule sentence of a definition, or 422 with what is wrong in it. Nothing is stored. */
  validate(definition: Definition): Observable<ValidateAnswer> {
    return this.http.post<ValidateAnswer>(`${this.base}/validate`, { definition });
  }

  /** The definition of one version: marks and clauses of a run come from the version that ran. */
  version(id: number, version: number): Observable<ControlVersion> {
    return this.http.get<ControlVersion>(`${this.base}/${id}/versions/${version}`);
  }
}
