import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Glossary } from '../../src/app/core/api/api.types';
import { toPublicGlossary } from '../../src/testing/public-glossary';

export const CONTRACTS = join(__dirname, '../../../contracts');

/** `contracts/glossary.json` as the file holds it: the fake engine reads its templates and physical names. */
export const glossaryFile: unknown = JSON.parse(readFileSync(join(CONTRACTS, 'glossary.json'), 'utf8'));

/** The glossary as `GET /glossary` serves it. */
export const glossary = toPublicGlossary(glossaryFile) satisfies Glossary;

/** The label of a glossary text in the interface language: specs read labels from here, never from a literal. */
export function label(text: Readonly<Record<string, string>> | undefined): string {
  return text?.[glossary.defaultLanguage] ?? '';
}
