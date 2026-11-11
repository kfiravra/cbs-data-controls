import { Locator } from '@playwright/test';

/** How many colours the fixed set of condition colours holds (`TONE_COUNT` in the client). */
const TONES = 8;

/**
 * The colours of a rule in words: for each condition, in the order its words first stand in the text, the
 * place of its colour in the fixed set. A rule has no letters; a condition is known by the line under its
 * words, and this is that line's colour as the page says it (`data-tone`).
 */
export function ruleTones(sentence: Locator): Promise<string[]> {
  return sentence
    .getByTestId('clause')
    .evaluateAll((clauses) => [
      ...new Map(clauses.map((clause) => [clause.getAttribute('data-node'), clause.getAttribute('data-tone') ?? ''])).values(),
    ]);
}

/** The places the first `count` conditions of a rule take: the set in its order, started again when it ends. */
export const tonesOf = (count: number): string[] => Array.from({ length: count }, (_, index) => String((index % TONES) + 1));
