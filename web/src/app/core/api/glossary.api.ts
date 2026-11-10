import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api-error';
import { Glossary } from './api.types';

@Injectable({ providedIn: 'root' })
export class GlossaryApi {
  private readonly http = inject(HttpClient);

  get(): Observable<Glossary> {
    return this.http.get<Glossary>(`${API_BASE}/glossary`);
  }
}
