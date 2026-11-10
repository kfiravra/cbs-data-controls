import { Control, ResultItem, Run, RunError } from '../../src/app/core/api/api.types';
import { FakeEngine } from '../support/fake-engine';
import { loadSeed } from '../support/seed';
import { ExpectedViolation, exampleOf } from './examples';
import { glossaryFile } from './glossary';

export interface StoredRun {
  readonly run: Run;
  readonly results: readonly ResultItem[];
}

const seed = loadSeed();

export const engine = new FakeEngine(glossaryFile, seed);

const RUN_DATE = '2026-11-10';

function baseRun(control: Control, id: number, startedAt: string): Run {
  return {
    id,
    controlId: control.id,
    controlName: control.name,
    controlVersion: control.version,
    rootEntity: control.rootEntity,
    runDate: RUN_DATE,
    language: 'he',
    startedAt,
    finishedAt: startedAt,
    status: 'succeeded',
    totalCount: null,
    storedCount: null,
    capExceeded: false,
    durationMs: 412,
    sentence: null,
    sentenceParts: null,
    conditions: null,
    error: null,
    previousRun: null,
  } satisfies Run;
}

export interface RunOptions {
  readonly startedAt?: string;
  /** The records the run flags; the expected records of the control's example when left out. */
  readonly expected?: readonly ExpectedViolation[];
  /** More violations found than stored: the total, above the number of `expected` records. */
  readonly totalAboveCap?: number;
  readonly previousRun?: Run['previousRun'];
}

/** A finished run: the engine's sentence, a count per condition, and one stored row per flagged record. */
export function succeededRun(control: Control, id: number, options: RunOptions = {}): StoredRun {
  const expected = options.expected ?? exampleOf(control.definition)?.expected.violations ?? [];
  const rendered = engine.sentenceOf(control.definition);
  const results = expected.map((violation, index) => ({
    seq: index + 1,
    ...engine.violation(control.definition, violation.key, violation.matched, RUN_DATE),
  })) satisfies ResultItem[];
  const total = options.totalAboveCap ?? results.length;
  const scale = results.length === 0 ? 0 : total / results.length;
  return {
    run: {
      ...baseRun(control, id, options.startedAt ?? new Date().toISOString()),
      totalCount: total,
      storedCount: results.length,
      capExceeded: total > results.length,
      sentence: rendered.sentence,
      sentenceParts: rendered.sentenceParts,
      conditions: rendered.conditions.map((condition) => ({
        ...condition,
        // counts are over all violations, also above the cap
        count: Math.round(results.filter((row) => row.matched.includes(condition.id)).length * scale),
      })),
      previousRun: options.previousRun ?? null,
    },
    results,
  };
}

/**
 * As many flagged records as asked, taken from the seed in key order, each matched by the control's first
 * condition: enough rows to page, sort and search through. The fake engine decides no violation, so the
 * records are not the ones a real run would flag.
 */
export function manyViolations(control: Control, count: number): ExpectedViolation[] {
  const file = glossaryFile as { entities: { key: string; table: { name: string }; keyColumn: string }[] };
  const root = file.entities.find((entity) => entity.key === control.rootEntity)!;
  const first = engine.sentenceOf(control.definition).conditions[0].id;
  return seed[root.table.name].slice(0, count).map((row) => ({ key: String(row[root.keyColumn]), matched: [first] }));
}

function stoppedRun(control: Control, id: number, status: Run['status'], error: RunError | null): StoredRun {
  const startedAt = new Date().toISOString();
  return {
    run: { ...baseRun(control, id, startedAt), status, error, durationMs: status === 'running' ? null : 30012 },
    results: [],
  };
}

export function timedOutRun(control: Control, id: number): StoredRun {
  return stoppedRun(control, id, 'timed_out', { code: 'QUERY_TIMEOUT', params: { timeoutSeconds: 30 } });
}

export function failedRun(control: Control, id: number, code: string): StoredRun {
  return stoppedRun(control, id, 'failed', { code, params: {} });
}

/** A run of a definition the glossary no longer fits: the engine's definition errors ride in the run error. */
export function outdatedRun(control: Control, id: number, nodeId: string): StoredRun {
  const index = control.definition.where.children.findIndex((child) => child.type !== 'group' && child.id === nodeId);
  return stoppedRun(control, id, 'failed', {
    code: 'CONTROL_DEFINITION_OUTDATED',
    params: {
      errors: [
        { code: 'UNKNOWN_FIELD', path: `/where/children/${index}/left`, nodeId, params: { entity: 'e', field: 'f' } },
      ],
    },
  });
}

/** Another user's run in progress, or one a crash cut off. */
export function runningRun(control: Control, id: number): StoredRun {
  const stored = stoppedRun(control, id, 'running', null);
  return { ...stored, run: { ...stored.run, finishedAt: null } };
}
