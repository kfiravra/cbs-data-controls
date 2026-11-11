import { ApiError } from '../../core/api/api-error';
import { DefinitionError } from '../../core/api/api.types';
import { Definition } from '../../core/definition/definition.types';
import { DraftGroup } from '../../core/definition/draft';
import { DraftCheck, DraftIssue } from '../../core/definition/draft.check';
import { orderedNodeIds } from '../../core/definition/marks';
import { ErrorLocation, locateError } from '../../core/definition/pointer';
import { RowMessage } from '../../shared/condition-builder/builder-view';
import { DetailIssue, Sent, StatusLine } from './editor.types';

/** The longest name and description the api stores (contracts/api.md). */
export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 1000;

/** What is wrong with a name as typed; null when nothing is. */
export function nameIssueOf(name: string): DetailIssue | null {
  const trimmed = name.trim();
  return trimmed === '' ? 'required' : trimmed.length > NAME_MAX ? 'tooLong' : null;
}

/** What is wrong with a description as typed; null when nothing is. */
export function descriptionIssueOf(description: string): DetailIssue | null {
  return description.trim().length > DESCRIPTION_MAX ? 'tooLong' : null;
}

/** A definition error of the server, with the row and the input it belongs to. */
export interface LocatedError {
  readonly error: DefinitionError;
  readonly location: ErrorLocation;
}

/** The definition errors of a refused request, each placed in the definition that was sent. */
export function locateErrors(error: ApiError, definition: Definition): LocatedError[] {
  return error.definitionErrors.map((entry) => ({ error: entry, location: locateError(entry, definition) }));
}

/** What a row says for an issue of the client's own check: the translation key and what it needs. */
export function issueMessage(issue: DraftIssue, check: DraftCheck): RowMessage {
  return {
    key: `editor.issues.${issue.kind}`,
    params: { max: check.limits.maxListValues },
    input: issue.input,
    index: issue.index,
  };
}

/** What a row says for an error of the server: the text of its code, on the input the error names. */
export function errorMessage({ error, location }: LocatedError): RowMessage {
  return { key: `errors.definition.${error.code}`, params: error.params, input: location.input, index: location.index };
}

/**
 * The one thing the sentence field says is unfinished: the first open condition in the order of the
 * definition, else too many values in all, else the first error the server gave.
 */
export function statusOf(
  draft: DraftGroup,
  check: DraftCheck,
  marks: ReadonlyMap<string, string>,
  refused: readonly LocatedError[],
): StatusLine | null {
  const firstOpen = orderedNodeIds(draft).find((id) => check.issues.has(id));
  if (firstOpen !== undefined) {
    return { kind: 'incomplete', mark: marks.get(firstOpen) ?? '', issue: check.issues.get(firstOpen)![0] };
  }
  if (check.tooManyValuesInAll) {
    return { kind: 'tooManyValues' };
  }
  const [first] = refused;
  if (!first) {
    return null;
  }
  const id = first.location.nodeId;
  return { kind: 'invalid', mark: id ? (marks.get(id) ?? null) : null, error: first.error };
}

/** Whether the screen holds what a save sent: nothing was typed or edited while the save was on its way. */
export function sameHeld(a: Sent, b: Sent): boolean {
  return a.name === b.name && a.description === b.description && a.draft === b.draft && a.rootEntity === b.rootEntity;
}
