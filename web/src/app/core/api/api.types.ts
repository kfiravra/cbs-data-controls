/**
 * The one mirror of `contracts/api.md` (the application API under `/api/v1`) and of the codes of
 * `contracts/errors.md`. `name?` is a member a response may leave out; `T | null` is always present.
 * Dates are `YYYY-MM-DD` strings and timestamps ISO 8601 strings.
 */
import { Definition, FieldRef, ListValue, Scalar } from '../definition/definition.types';
import { LocalizedText } from '../i18n/language';

export type { Definition, FieldRef };

// ---------------------------------------------------------------- rendered text

export type TextPartRole = 'field' | 'value' | 'actual' | 'other' | 'otherActual' | 'relationship';

export interface TextPart {
  readonly text: string;
  /** The node whose clause the part belongs to; absent on joining words and brackets. */
  readonly nodeId?: string;
  /** The placeholder the part came from; absent on template text. */
  readonly role?: TextPartRole;
}

// ---------------------------------------------------------------- problems

export interface DefinitionError {
  readonly code: string;
  /** JSON Pointer into the definition; `""` is the definition. */
  readonly path: string;
  readonly nodeId?: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface RequestError {
  readonly path: string;
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly errors?: readonly (DefinitionError | RequestError)[];
  readonly correlationId: string;
}

// ---------------------------------------------------------------- health

export type HealthState = 'ok' | 'unavailable';

/** `GET /api/v1/health`: always 200, also when the stack is degraded. */
export interface Health {
  readonly status: 'ok' | 'degraded';
  readonly database: HealthState;
  readonly engine: HealthState;
  readonly version: string;
}

// ---------------------------------------------------------------- pages

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// ---------------------------------------------------------------- controls

export interface Control {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly rootEntity: string;
  readonly version: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly concurrencyToken: string;
  readonly definition: Definition;
}

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'timed_out';

export interface LastRun {
  readonly id: number;
  readonly startedAt: string;
  readonly status: RunStatus;
  readonly totalCount: number | null;
}

export interface ControlSummary extends Omit<Control, 'definition' | 'concurrencyToken'> {
  readonly lastRun: LastRun | null;
}

export interface ControlVersion {
  readonly version: number;
  readonly createdAt: string;
  readonly definition: Definition;
}

export interface ControlDraftBody {
  readonly name: string;
  readonly description?: string | null;
  readonly definition: Definition;
}

export interface ControlUpdateBody extends ControlDraftBody {
  readonly concurrencyToken: string;
}

export type ActiveFilter = 'true' | 'false' | 'all';

export interface ControlsQuery {
  readonly search?: string;
  readonly rootEntity?: string;
  readonly active?: ActiveFilter;
  readonly page?: number;
  readonly pageSize?: number;
}

// ---------------------------------------------------------------- validate

export interface ConditionSummary {
  readonly id: string;
  readonly sentence: string;
  readonly sentenceParts: readonly TextPart[];
  /** In a run only: the violations in which the node is matched, over all violations. */
  readonly count?: number;
}

export interface ValidateAnswer {
  readonly valid: boolean;
  readonly sentence: string;
  readonly sentenceParts: readonly TextPart[];
  readonly conditions: readonly ConditionSummary[];
}

// ---------------------------------------------------------------- runs

export interface RunError {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface PreviousRun {
  readonly id: number;
  readonly startedAt: string;
  readonly totalCount: number;
}

export interface Run {
  readonly id: number;
  readonly controlId: number;
  readonly controlName: string;
  readonly controlVersion: number;
  readonly rootEntity: string;
  readonly runDate: string;
  readonly language: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly status: RunStatus;
  readonly totalCount: number | null;
  readonly storedCount: number | null;
  readonly capExceeded: boolean;
  readonly durationMs: number | null;
  readonly sentence: string | null;
  readonly sentenceParts: readonly TextPart[] | null;
  readonly conditions: readonly ConditionSummary[] | null;
  readonly error: RunError | null;
  readonly previousRun: PreviousRun | null;
}

export interface ReasonParams {
  readonly left?: FieldRef;
  readonly actual?: Scalar | null;
  readonly value?: Scalar;
  readonly values?: readonly ListValue[];
  readonly right?: FieldRef;
  readonly rightActual?: Scalar | null;
  readonly relationship?: string;
}

export interface Reason {
  /** The id of the matched node: a condition or a related node. */
  readonly conditionId: string;
  readonly reasonKey: string;
  readonly params: ReasonParams;
  readonly text: string;
  readonly textParts: readonly TextPart[];
}

export interface Violation {
  readonly key: string;
  /** The root entity's identifying fields, field key to value; laid out in `identifyingFields` order. */
  readonly display: Readonly<Record<string, Scalar | null>>;
  readonly matched: readonly string[];
  readonly reasons: readonly Reason[];
  readonly reasonText: string;
}

export interface ResultItem extends Violation {
  /** From 1: the violation's position in the engine's order. */
  readonly seq: number;
}

export type ResultsSort = 'key' | 'display';
export type SortDirection = 'asc' | 'desc';

export interface ResultsQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly condition?: string;
  readonly sort?: ResultsSort;
  readonly dir?: SortDirection;
}

// ---------------------------------------------------------------- suggestions

export interface Evidence {
  readonly key: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly text: string;
}

export interface SuggestionItem {
  readonly name: string;
  readonly description: string;
  readonly rationale: string;
  readonly evidence: readonly Evidence[];
  readonly definition: Definition;
  readonly sentence: string;
  readonly sentenceParts: readonly TextPart[];
}

export interface SuggestionsAnswer {
  readonly items: readonly SuggestionItem[];
}

export interface AcceptBody {
  readonly items: readonly ControlDraftBody[];
}

export interface AcceptAnswer {
  readonly items: readonly Control[];
}

// ---------------------------------------------------------------- the public glossary

export type FieldType = 'number' | 'text' | 'date' | 'bool' | 'enum';
export type Arity = 0 | 1 | 2 | 'list';
export type Cardinality = 'many_to_one' | 'one_to_one' | 'one_to_many';

/** Variants of an operator text: `<type>.field`, `field`, `<type>`, `default`. */
export type TextVariants = Readonly<Record<string, LocalizedText>>;

export interface GlossaryLimits {
  readonly maxDepth: number;
  readonly maxConditions: number;
  readonly maxListValues: number;
  readonly maxPathHops: number;
  readonly maxTotalValues: number;
}

export interface GlossaryFormat {
  readonly date: string;
  readonly groupSeparator: string;
  readonly decimalSeparator: string;
}

export interface GlossaryOperator {
  readonly key: string;
  readonly arity: Arity;
  readonly types: readonly FieldType[];
  readonly fieldComparable: boolean;
  readonly label: TextVariants;
  readonly sentence: TextVariants;
  readonly reason: TextVariants;
}

export interface GlossaryField {
  readonly key: string;
  readonly label: LocalizedText;
  readonly description?: LocalizedText;
  readonly type: FieldType;
  readonly nullable: boolean;
  readonly visible: boolean;
  /** The resolved operator keys, in glossary order. */
  readonly operators: readonly string[];
  /** Absent means true; false keeps the field out of a field-to-field comparison. */
  readonly comparable?: boolean;
  /** True on a number that names a record: written digit for digit. */
  readonly identifier?: boolean;
  readonly unit?: LocalizedText;
  readonly enumValues?: readonly { readonly value: string; readonly label: LocalizedText }[];
  readonly valueLabels?: { readonly true: LocalizedText; readonly false: LocalizedText };
  readonly required?: string;
}

export interface GlossaryEntity {
  readonly key: string;
  readonly label: { readonly singular: LocalizedText; readonly plural: LocalizedText };
  readonly description: LocalizedText;
  readonly rootable: boolean;
  readonly visible: boolean;
  readonly identifyingFields: readonly string[];
  readonly lifecycle?: { readonly field: string; readonly active: Scalar };
  readonly fields: readonly GlossaryField[];
}

export interface GlossaryRelationship {
  readonly key: string;
  readonly from: string;
  readonly to: string;
  readonly cardinality: Cardinality;
  readonly label: LocalizedText;
}

export interface Glossary {
  readonly glossaryVersion: string;
  readonly languages: readonly string[];
  readonly defaultLanguage: string;
  readonly limits: GlossaryLimits;
  readonly formats: Readonly<Record<string, GlossaryFormat>>;
  /** Texts and templates of the engine's renderer; the client draws rendered text and reads none of these. */
  readonly phrases: Readonly<Record<string, unknown>>;
  readonly operators: readonly GlossaryOperator[];
  readonly entities: readonly GlossaryEntity[];
  readonly relationships: readonly GlossaryRelationship[];
  readonly suggestions: Readonly<Record<string, unknown>>;
}
