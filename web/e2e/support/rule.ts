import { Locator } from '@playwright/test';

/** The fixed set of condition colours, as the page names its places (`--color-tone-1` and on, in tokens.scss). */
const SET = ['1', '2', '3', '4', '5', '6', '7', '8'];

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

/**
 * The places the first `count` conditions of a rule take: the set from its start, written out. A rule of more
 * conditions than the set holds starts the set again, and a spec of one says so itself.
 */
export function tonesOf(count: number): string[] {
  if (count > SET.length) {
    throw new Error(`a rule of ${count} conditions has more than the ${SET.length} colours of the set: write its colours out in the spec`);
  }
  return SET.slice(0, count);
}

/** The colour a letter stands on, as the browser paints it. */
export function groundOf(mark: Locator): Promise<string> {
  return mark.evaluate((element) => getComputedStyle(element).backgroundColor);
}

/**
 * The colour of the line under a condition's words, as the browser paints it: the solid stretch of the drawn
 * line, between its two faded ends. Empty when no line is drawn.
 */
export function lineOf(clause: Locator): Promise<string> {
  return clause.evaluate(
    (element) => (getComputedStyle(element).backgroundImage.match(/rgba?\([^)]*\)/g) ?? []).find((colour) => colour !== 'rgba(0, 0, 0, 0)') ?? '',
  );
}

/** How strong a painted colour is, from 0 to 1. */
export function strengthOf(colour: string): number {
  const parts = colour.match(/[\d.]+/g) ?? [];
  return parts.length === 4 ? Number(parts[3]) : 1;
}
