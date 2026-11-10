import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { Control } from '../../src/app/core/api/api.types';
import { Definition } from '../../src/app/core/definition/definition.types';
import { CONTRACTS, glossary } from './glossary';

export interface ExpectedViolation {
  readonly key: string;
  readonly matched: readonly string[];
}

export interface Example {
  readonly id: string;
  readonly name: Readonly<Record<string, string>>;
  readonly description: Readonly<Record<string, string>>;
  readonly runDate: string;
  readonly heuristic?: boolean;
  readonly definition: Definition;
  readonly expected: { readonly total: number; readonly violations: readonly ExpectedViolation[] };
}

const DIR = join(CONTRACTS, 'examples');
const lang = glossary.defaultLanguage;

/** Every example of `contracts/examples/`, in file order. */
export const examples: readonly Example[] = readdirSync(DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(DIR, name), 'utf8')) as Example);

/**
 * The six examples in the order the documents number them (sql/README.md): 1 to 4 are the assignment's own,
 * 5 has a related-records node, 6 a two-hop path and a nested group.
 */
const NUMBERED = [
  'minor-high-salary',
  'termination-before-hire',
  'active-in-inactive-department',
  'missing-mandatory-data',
  'department-without-active-employees',
  'inactive-ministry-salary-out-of-range',
] as const;

/** Example `number` of the documents, from 1. */
export function exampleNumber(number: 1 | 2 | 3 | 4 | 5 | 6): Example {
  return exampleById(NUMBERED[number - 1]);
}

export function exampleById(id: string): Example {
  const example = examples.find((candidate) => candidate.id === id);
  if (!example) {
    throw new Error(`contracts/examples has no example "${id}"`);
  }
  return example;
}

/** The example a definition was taken from, if any: a run of it flags the example's expected records. */
export function exampleOf(definition: Definition): Example | undefined {
  const wanted = JSON.stringify(definition);
  return examples.find((example) => JSON.stringify(example.definition) === wanted);
}

export function controlOf(example: Example, id: number): Control {
  return {
    id,
    name: example.name[lang],
    description: example.description[lang],
    rootEntity: example.definition.rootEntity,
    version: 1,
    isActive: true,
    createdAt: '2026-11-01T07:00:00.000Z',
    updatedAt: '2026-11-01T07:00:00.000Z',
    concurrencyToken: `token-${id}-1`,
    definition: example.definition,
  } satisfies Control;
}

/** The six examples as the delivered system holds them: loaded through the api, never run. */
export function exampleControls(): Control[] {
  return examples.map((example, index) => controlOf(example, index + 1));
}
