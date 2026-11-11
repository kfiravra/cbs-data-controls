import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { API_BASE, ApiError } from '../api/api-error';
import { Problem } from '../api/api.types';

function isProblem(body: unknown): body is Problem {
  return typeof body === 'object' && body !== null && typeof (body as Problem).code === 'string';
}

/**
 * Turns every failed api response into an `ApiError`: a problem body as it is, and anything else (no
 * connection, a gateway page) as the client code `NETWORK_ERROR` (contracts/errors.md, Codes).
 */
export const problemInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE)) {
    return next(request);
  }
  return next(request).pipe(
    catchError((response: unknown) => {
      const status = response instanceof HttpErrorResponse ? response.status : 0;
      const body: unknown = response instanceof HttpErrorResponse ? response.error : null;
      const error = isProblem(body)
        ? new ApiError(status, body.code, body.params ?? {}, body.errors ?? [], body.correlationId ?? null)
        : new ApiError(status, 'NETWORK_ERROR');
      return throwError(() => error);
    }),
  );
};
