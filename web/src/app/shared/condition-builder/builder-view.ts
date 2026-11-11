import { Glossary } from '../../core/api/api.types';
import { DraftCheck, NodeInput } from '../../core/definition/draft.check';

/** A message under a row: a translation key with its parameters, and the input it is about when it names one. */
export interface RowMessage {
  readonly key: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly input?: NodeInput;
  readonly index?: number;
}

/**
 * What the builder draws beside the draft itself: one object handed down the recursive tree, so a new piece
 * of state does not add an input to every level.
 */
export interface BuilderView {
  readonly glossary: Glossary;
  /** Node id to its mark. */
  readonly marks: ReadonlyMap<string, string>;
  readonly check: DraftCheck;
  /** By node id: what to say under the row (its issues once the user asked to save, and the server's errors). */
  readonly messages: ReadonlyMap<string, readonly RowMessage[]>;
  /**
   * Whether the advanced actions are offered: adding a group, and a condition on related records. Off, the
   * builder is a flat list of conditions with one switch (all of them, or at least one).
   */
  readonly advanced: boolean;
}
