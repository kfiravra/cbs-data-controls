import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Violation } from '../../src/app/core/api/api.types';
import { Definition } from '../../src/app/core/definition/definition.types';
import { examples } from '../fixtures/examples';
import { CONTRACTS } from '../fixtures/glossary';
import { engine } from '../fixtures/runs';

/**
 * The mocked specs draw what the fake engine renders, so it is held to the one worked example the contract
 * gives: the request and the answer of "A /run answer" in contracts/api.md §5.
 */
test.describe('fake engine', () => {
  const blocks = [...readFileSync(join(CONTRACTS, 'api.md'), 'utf8').matchAll(/```json\n([\s\S]*?)```/g)].map(
    (match) => JSON.parse(match[1]) as Record<string, unknown>,
  );
  const request = blocks.find((block) => 'definition' in block && 'rowCap' in block) as {
    definition: Definition;
    runDate: string;
  };
  const answer = blocks.find((block) => 'violations' in block) as {
    sentence: string;
    sentenceParts: unknown;
    conditions: { id: string; sentence: string; sentenceParts: unknown }[];
    violations: Violation[];
  };

  test('renders the rule sentence and each condition as the contract example does', () => {
    const rendered = engine.sentenceOf(request.definition);

    expect(rendered.sentence).toBe(answer.sentence);
    expect(rendered.sentenceParts).toEqual(answer.sentenceParts);
    expect(rendered.conditions).toEqual(answer.conditions.map(({ id, sentence, sentenceParts }) => ({ id, sentence, sentenceParts })));
  });

  test('renders the violations of the contract example, reasons and actual values included', () => {
    for (const expected of answer.violations) {
      expect(engine.violation(request.definition, expected.key, expected.matched, request.runDate)).toEqual(expected);
    }
  });

  test('renders every example of the contracts without a placeholder left in the text', () => {
    for (const example of examples) {
      const rendered = engine.sentenceOf(example.definition);
      expect(rendered.sentence, example.id).not.toMatch(/[{}]/);
      expect(rendered.sentenceParts.every((part) => part.text !== ''), example.id).toBe(true);
      for (const violation of example.expected.violations) {
        const row = engine.violation(example.definition, violation.key, violation.matched, example.runDate);
        expect(row.reasons.map((reason) => reason.conditionId), `${example.id} ${violation.key}`).toEqual(violation.matched);
        expect(row.reasonText, `${example.id} ${violation.key}`).not.toMatch(/[{}]/);
      }
    }
  });
});
