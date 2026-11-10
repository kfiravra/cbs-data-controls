import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { Glossary } from '../app/core/api/api.types';
import { Definition } from '../app/core/definition/definition.types';
import { CONTRACTS_ROOT, readJson } from './files';
import { toPublicGlossary } from './public-glossary';

export interface ExampleFile {
  readonly id: string;
  readonly name: Record<string, string>;
  readonly description: Record<string, string>;
  readonly definition: Definition;
  readonly expected: { readonly total: number; readonly violations: { key: string; matched: string[] }[] };
}

export interface InvalidFile {
  readonly file: string;
  readonly layer: 'schema' | 'semantic';
  readonly expected: { readonly code: string; readonly path: string };
  readonly definition: Definition;
}

/** The glossary as the engine serves it, built from the contract file on disk. */
export function contractGlossary(): Glossary {
  return toPublicGlossary(readJson(join(CONTRACTS_ROOT, 'glossary.json')));
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

/** Every example of `contracts/examples/`, whatever their number. */
export function contractExamples(): ExampleFile[] {
  const dir = join(CONTRACTS_ROOT, 'examples');
  return jsonFiles(dir).map((name) => readJson<ExampleFile>(join(dir, name)));
}

/** Every invalid fixture of `contracts/examples/invalid/`, with the error each must give. */
export function contractInvalidFixtures(): InvalidFile[] {
  const dir = join(CONTRACTS_ROOT, 'examples', 'invalid');
  return jsonFiles(dir).map((name) => ({ ...readJson<Omit<InvalidFile, 'file'>>(join(dir, name)), file: name }));
}
