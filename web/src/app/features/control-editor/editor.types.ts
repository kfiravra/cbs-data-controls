import { ApiError } from '../../core/api/api-error';
import { Control, DefinitionError, Run, SuggestionItem, TextPart } from '../../core/api/api.types';
import { Definition } from '../../core/definition/definition.types';
import { DraftGroup, IdSource } from '../../core/definition/draft';
import { DraftIssue } from '../../core/definition/draft.check';

export type LoadState = 'loading' | 'ready' | 'notFound' | 'failed';
export type SaveState = 'idle' | 'saving' | 'running';
export type DetailIssue = 'required' | 'tooLong';

/** What the page is asked to open: a stored control, a copy of one, a suggestion, or a blank control. */
export interface EditorTarget {
  readonly id: number | null;
  /** The control to copy into a new one (duplicate). */
  readonly from?: number | null;
  /** A suggested control to start from. */
  readonly draft?: { readonly name: string; readonly description: string; readonly definition: Definition } | null;
  /** The name a copy starts with, from the name of its source. */
  readonly copyName?: (name: string) => string;
}

export type SaveOutcome =
  | { readonly kind: 'invalid' | 'failed' }
  | { readonly kind: 'saved'; readonly control: Control; readonly created: boolean; readonly newVersion: boolean }
  | { readonly kind: 'ran'; readonly control: Control; readonly run: Run };

/** What the sentence field says under the sentence when something is unfinished. */
export type StatusLine =
  | { readonly kind: 'incomplete'; readonly mark: string; readonly issue: DraftIssue }
  | { readonly kind: 'invalid'; readonly mark: string | null; readonly error: DefinitionError }
  | { readonly kind: 'tooManyValues' };

export interface Sentence {
  /** The parts of the last valid sentence; null until the engine has answered once. */
  readonly parts: readonly TextPart[] | null;
  /** True while the draft is unfinished or invalid: the last valid sentence stays, dimmed. */
  readonly stale: boolean;
}

/** What the validate loop asks the engine about. */
export interface Question {
  readonly definition: Definition;
  readonly text: string;
  readonly again: number;
}

export type Validation =
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'valid'; readonly parts: readonly TextPart[] }
  | { readonly kind: 'failed'; readonly error: ApiError; readonly definition: Definition };

/** What a save sent, to tell afterwards whether the screen was edited meanwhile. */
export interface Sent {
  readonly name: string;
  readonly description: string;
  readonly draft: DraftGroup;
  readonly rootEntity: string | null;
}

/** What a removal took away, and the way back. */
export interface Removal {
  /** The mark of the condition that was removed; undefined for a group, which goes with its conditions. */
  readonly mark?: string;
  readonly undo: () => void;
}

/**
 * A draft as the editor held it when it was closed without a save: the details, the choice and the tree,
 * and beside them what is needed to put it back on the screen.
 */
export interface EditorSnapshot extends Sent {
  /** The stored control the draft edits, with its token; null for a control that was never saved. */
  readonly control: Control | null;
  /** The source of the draft's ids: an id given after the draft came back must not repeat one of its own. */
  readonly ids: IdSource;
  readonly fromNothing: boolean;
  readonly advanced: boolean;
  readonly ideas: readonly SuggestionItem[];
}
