import { HttpParams } from '@angular/common/http';

/** Query parameters from an object, leaving out what was not given: absent means "not asked". */
export function queryParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(name, String(value));
    }
  }
  return params;
}
