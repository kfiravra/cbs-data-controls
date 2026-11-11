import { DefinitionError, RequestError } from './api.types';

/** The path every call of the application API starts with; relative, so the dev proxy and the api's own host both serve it. */
export const API_BASE = '/api/v1';

/**
 * Every failed call, as codes and params only (contracts/errors.md). `detail`, a status text and the
 * correlation id are never shown; the id is kept for a log line.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly params: Readonly<Record<string, unknown>> = {},
    readonly errors: readonly (DefinitionError | RequestError)[] = [],
    readonly correlationId: string | null = null,
  ) {
    super(code);
    this.name = 'ApiError';
  }

  /** The definition errors of a `DEFINITION_INVALID` problem; empty for any other code. */
  get definitionErrors(): readonly DefinitionError[] {
    return this.code === 'DEFINITION_INVALID' ? (this.errors as readonly DefinitionError[]) : [];
  }
}

/** What a caller that caught something unknown may treat as an api failure. */
export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'INTERNAL_ERROR');
}
