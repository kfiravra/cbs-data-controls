import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api-error';
import { Page, ResultItem, ResultsQuery, Run } from './api.types';
import { queryParams } from './params';

@Injectable({ providedIn: 'root' })
export class RunsApi {
  private readonly http = inject(HttpClient);

  /**
   * Runs the control's current version on today's date. The answer is the finished run whatever its
   * outcome: a failure is the run's `status` and `error`, not an error response.
   */
  start(controlId: number): Observable<Run> {
    return this.http.post<Run>(`${API_BASE}/controls/${controlId}/runs`, {});
  }

  get(id: number): Observable<Run> {
    return this.http.get<Run>(`${API_BASE}/runs/${id}`);
  }

  /** A page of the run's stored violations; search, filter and sort read the snapshot. */
  results(id: number, query: ResultsQuery): Observable<Page<ResultItem>> {
    return this.http.get<Page<ResultItem>>(`${API_BASE}/runs/${id}/results`, { params: queryParams(query) });
  }
}
