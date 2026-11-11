import { Signal, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';

import { toApiError } from '../../core/api/api-error';
import { ControlsApi } from '../../core/api/controls.api';
import { Definition } from '../../core/definition/definition.types';
import { Question, Validation } from './editor.types';

/** The sentence asks the engine this long after the last edit. */
export const VALIDATE_DEBOUNCE_MS = 400;

/**
 * The validate loop, as what the engine says about each definition the draft becomes. An unfinished draft
 * (a null definition) sends nothing and answers `incomplete` at once. A complete one asks the engine 400ms
 * after the last edit; the next edit cancels the wait and the request, so an older answer never replaces a
 * newer one. `again` asks about the same definition once more. Called where `inject` works.
 */
export function validations(
  definition: Signal<Definition | null>,
  again: Signal<number>,
  api: ControlsApi,
): Observable<Validation> {
  // one question per definition and per "ask again": an edit that leaves the rule as it was asks nothing
  const asked = computed<Question | null>(
    () => {
      const current = definition();
      return current ? { definition: current, text: JSON.stringify(current), again: again() } : null;
    },
    { equal: (a, b) => a?.text === b?.text && a?.again === b?.again },
  );
  return toObservable(asked).pipe(
    switchMap((question) => {
      if (question === null) {
        return of<Validation>({ kind: 'incomplete' });
      }
      return timer(VALIDATE_DEBOUNCE_MS).pipe(
        switchMap(() => api.validate(question.definition)),
        map((answer): Validation => ({ kind: 'valid', parts: answer.sentenceParts })),
        catchError((error: unknown) =>
          of<Validation>({ kind: 'failed', error: toApiError(error), definition: question.definition }),
        ),
      );
    }),
  );
}
