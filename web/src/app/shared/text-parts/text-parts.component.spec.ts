import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestTranslations, t } from '../../../testing/translate';
import { TextPart } from '../../core/api/api.types';
import { TextPartsComponent } from './text-parts.component';

// shapes of contracts/api.md §5: a sentence of two clauses, and a reason with its actual value
const SENTENCE: TextPart[] = [
  { text: 'age', nodeId: 'c1', role: 'field' },
  { text: ' under ', nodeId: 'c1' },
  { text: '18', nodeId: 'c1', role: 'value' },
  { text: ' and ' },
  { text: 'monthly salary', nodeId: 'c2', role: 'field' },
  { text: ' over ', nodeId: 'c2' },
  { text: '15,000', nodeId: 'c2', role: 'value' },
];
const REASON: TextPart[] = [
  { text: 'age', nodeId: 'c1', role: 'field' },
  { text: ': ', nodeId: 'c1' },
  { text: '16', nodeId: 'c1', role: 'actual' },
  { text: ' (under ', nodeId: 'c1' },
  { text: '18', nodeId: 'c1', role: 'value' },
  { text: ')', nodeId: 'c1' },
];
const MARKS = new Map([
  ['c1', 'A'],
  ['c2', 'B'],
]);

describe('TextPartsComponent', () => {
  let fixture: ComponentFixture<TextPartsComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const marks = () => [...host().querySelectorAll('app-mark')];
  const clauses = () => [...host().querySelectorAll<HTMLElement>('[data-testid="clause"]')];
  const drawn = () => host().querySelector<HTMLElement>('[data-testid="drawn-text"]')!;
  const units = () => [...host().querySelectorAll<HTMLElement>('[data-testid="rule-unit"]')];
  /** The joining words of the rule, in its order. */
  const leads = () => [...host().querySelectorAll<HTMLElement>('[data-testid="rule-lead"]')].map((lead) => lead.textContent?.trim());
  /** What carries a line under it (the colour's place is what draws one): the words of a condition, and nothing else of the rule. */
  const underlined = () => [...drawn().querySelectorAll<HTMLElement>('[data-tone]')].map((element) => element.getAttribute('data-testid'));

  async function draw(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TextPartsComponent], providers: [provideTestTranslations()] });
    fixture = TestBed.createComponent(TextPartsComponent);
  });

  it('draws exactly the text the engine wrote when it is given no marks', async () => {
    await draw({ parts: SENTENCE });

    expect(host().textContent).toBe('age under 18 and monthly salary over 15,000');
    expect(marks()).toHaveLength(0);
  });

  it('writes no letter in the text and gives no word a ground: a condition is known by the line under its words', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });

    expect(marks()).toHaveLength(0);
    // the engine's words and its own spacing, nothing added and nothing taken
    expect(drawn().textContent).toBe('age under 18 and monthly salary over 15,000');
    expect(clauses().map((clause) => [clause.getAttribute('data-node'), clause.getAttribute('data-tone'), clause.textContent])).toEqual([
      ['c1', '1', 'age under 18'],
      ['c2', '2', 'monthly salary over 15,000'],
    ]);
    // the joining word between two conditions belongs to neither
    expect(drawn().querySelectorAll('[data-tone]')).toHaveLength(2);
  });

  it('gives the conditions the colours of the set in the order of their marks, and starts the set again when it ends', async () => {
    // ten conditions over a set of eight colours
    const many = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];
    const parts: TextPart[] = many.flatMap((id, index) => [...(index > 0 ? [{ text: ' and ' }] : []), { text: `rule ${id}`, nodeId: id }]);

    await draw({ parts, marks: new Map(many.map((id, index) => [id, String(index + 1)])) });

    expect(clauses().map((clause) => clause.getAttribute('data-tone'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '1', '2']);
  });

  it('gives the plain sentence to be read, each condition named by its mark, and hides the drawing from that reading', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });

    const named = (mark: string) => t('common.condition', { mark });
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe(
      `${named('A')} age under 18 and ${named('B')} monthly salary over 15,000`,
    );
    expect(host().querySelector('[data-testid="drawn-text"]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('reads the plain sentence with no condition named where no letter stands on the screen', async () => {
    await draw({ parts: SENTENCE, marks: MARKS, named: false });

    // the colours are drawn all the same, and what is read is the engine's sentence alone
    expect(clauses().map((clause) => clause.getAttribute('data-tone'))).toEqual(['1', '2']);
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe('age under 18 and monthly salary over 15,000');
    expect(host().querySelector('[data-testid="drawn-text"]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the actual value of a reason and no other part', async () => {
    await draw({ parts: REASON, markValues: true });

    expect([...host().querySelectorAll('app-value')].map((value) => value.textContent)).toEqual(['16']);
    expect(host().textContent).toBe('age: 16 (under 18)');
  });

  it('leaves an actual value unmarked in a text that does not mark values', async () => {
    await draw({ parts: REASON });

    expect(host().querySelector('app-value')).toBeNull();
  });

  it('keeps a value on one line, so a number is never parted from its unit', async () => {
    const withUnit = SENTENCE.map((part) => (part.text === '15,000' ? { ...part, text: '15,000 units' } : part));

    await draw({ parts: withUnit });

    const whole = [...host().querySelectorAll('.nb')].map((element) => element.textContent);
    expect(whole).toEqual(['18', '15,000 units']);
    expect(host().textContent).toBe('age under 18 and monthly salary over 15,000 units');
  });

  it('plays the settle on the words of a condition that was just rewritten, and on no other', async () => {
    await draw({ parts: SENTENCE, marks: MARKS, changed: new Set(['c2']) });

    expect(clauses().map((clause) => clause.classList.contains('clause--changed'))).toEqual([false, true]);
  });

  it('draws a rule as one flowing sentence: a condition with the joining word before it is one piece, and nothing else parts the text', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });

    // the engine's words and spacing, and no element that makes a line or sets one in
    expect(drawn().textContent).toBe('age under 18 and monthly salary over 15,000');
    expect(units().map((unit) => unit.textContent)).toEqual(['age under 18', 'and monthly salary over 15,000']);
    expect([...drawn().children].map((child) => child.getAttribute('data-testid'))).toEqual(['rule-unit', 'rule-gap', 'rule-unit']);
    // the space before a joining word is between the pieces, where a line may break; the one after it is not
    expect(host().querySelector('[data-testid="rule-gap"]')!.textContent).toBe(' ');
    expect(host().querySelector('[data-testid="rule-lead"] .nb')!.textContent).toBe(' ');
    // only the two conditions carry a line: the joining word and the spaces carry none
    expect(leads()).toEqual(['and']);
    expect(underlined()).toEqual(['clause', 'clause']);
  });

  it('writes what a condition on related records holds after its words, with no bracket and no line but those of the conditions', async () => {
    const related: TextPart[] = [
      { text: 'no ', nodeId: 'r1' },
      { text: 'line', nodeId: 'r1', role: 'relationship' },
      { text: ' with (', nodeId: 'r1' },
      { text: 'quantity', nodeId: 'c2', role: 'field' },
      { text: ' over 3', nodeId: 'c2' },
      { text: ' and ' },
      { text: 'price', nodeId: 'c3', role: 'field' },
      { text: ' under 2', nodeId: 'c3' },
      { text: ')', nodeId: 'r1' },
    ];

    await draw({ parts: related, marks: new Map([['r1', 'A'], ['c2', 'B'], ['c3', 'C']]) });

    expect(drawn().textContent).toBe('no line with quantity over 3 and price under 2');
    expect(units().map((unit) => unit.textContent)).toEqual(['no line with', 'quantity over 3', 'and price under 2']);
    // the related node and the conditions inside it each keep their own colour
    expect(clauses().map((clause) => [clause.getAttribute('data-node'), clause.getAttribute('data-tone')])).toEqual([
      ['r1', '1'],
      ['c2', '2'],
      ['c3', '3'],
    ]);
    // the joining word inside what the node holds carries no line, like any other
    expect(leads()).toEqual(['and']);
    expect(underlined()).toEqual(['clause', 'clause', 'clause']);
    const named = (mark: string) => t('common.condition', { mark });
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe(
      `${named('A')} no line with (${named('B')} quantity over 3 and ${named('C')} price under 2)`,
    );
  });

  it('writes a rule with groups as one sentence with no bracket, and underlines the conditions alone: no joining word carries a line, in a group or out of one', async () => {
    const nested: TextPart[] = [
      { text: '(' },
      { text: 'state: open', nodeId: 'c1' },
      { text: ' and ' },
      { text: '(' },
      { text: 'mail: empty', nodeId: 'c2' },
      { text: ' or ' },
      { text: 'pay: missing', nodeId: 'c3' },
      { text: ')' },
      { text: ' and ' },
      { text: 'age over 3', nodeId: 'c4' },
      { text: ')' },
      { text: ' or ' },
      { text: '(' },
      { text: 'state: closed', nodeId: 'c5' },
      { text: ')' },
    ];

    await draw({ parts: nested, marks: new Map([['c1', 'A'], ['c2', 'B'], ['c3', 'C'], ['c4', 'D'], ['c5', 'E']]) });

    // one sentence, the engine's words in their order, and no bracket
    expect(drawn().textContent).toBe('state: open and mail: empty or pay: missing and age over 3 or state: closed');
    expect(units().map((unit) => unit.textContent)).toEqual(['state: open', 'and mail: empty', 'or pay: missing', 'and age over 3', 'or state: closed']);
    // the joining words of the groups and of the top level are drawn alike: none carries a line
    expect(leads()).toEqual(['and', 'or', 'and', 'or']);
    expect(underlined()).toEqual(['clause', 'clause', 'clause', 'clause', 'clause']);
    // nothing but pieces and the spaces between them: no line, no block, no step in
    expect([...drawn().children].every((child) => child.matches('[data-testid="rule-unit"], [data-testid="rule-gap"]'))).toBe(true);
    const named = (mark: string) => t('common.condition', { mark });
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe(
      `(${named('A')} state: open and (${named('B')} mail: empty or ${named('C')} pay: missing) and ${named('D')} age over 3) or (${named('E')} state: closed)`,
    );
  });

  it('gives the joining word before a group to the first condition of the group', async () => {
    const mixed: TextPart[] = [{ text: 'a', nodeId: 'c1' }, { text: ' and ' }, { text: '(' }, { text: 'b', nodeId: 'c2' }, { text: ' or ' }, { text: 'c', nodeId: 'c3' }, { text: ')' }];

    await draw({ parts: mixed, marks: new Map([['c1', 'A'], ['c2', 'B'], ['c3', 'C']]) });

    expect(units().map((unit) => unit.textContent)).toEqual(['a', 'and b', 'or c']);
    expect(leads()).toEqual(['and', 'or']);
    expect(underlined()).toEqual(['clause', 'clause', 'clause']);
  });

  it('writes a joining word that no condition follows as it came, at the end of the text', async () => {
    const open: TextPart[] = [{ text: '(' }, { text: 'a', nodeId: 'c1' }, { text: ' or ' }, { text: 'b', nodeId: 'c2' }, { text: ')' }, { text: ' and ' }];

    await draw({ parts: open, marks: new Map([['c1', 'A'], ['c2', 'B']]) });

    expect(drawn().textContent).toBe('a or b and ');
    expect(units().map((unit) => unit.textContent)).toEqual(['a', 'or b']);
  });

  it('draws a text with no marks as its words in a row: no pieces, no line, and no bracket of a group', async () => {
    const chip: TextPart[] = [
      { text: 'no ', nodeId: 'r1' },
      { text: 'line', nodeId: 'r1', role: 'relationship' },
      { text: ' with (', nodeId: 'r1' },
      { text: 'quantity over 3', nodeId: 'c2' },
      { text: ')', nodeId: 'r1' },
    ];

    await draw({ parts: chip });

    expect(drawn().textContent).toBe('no line with quantity over 3');
    expect(units()).toHaveLength(0);
    expect(host().querySelector('[data-tone]')).toBeNull();
    // the bracket is not drawn, so the engine's own sentence is what is read
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe('no line with (quantity over 3)');
  });

  it('writes a bracket that the user typed, or that a label holds, as it is, and makes no line of it', async () => {
    const typed: TextPart[] = [
      { text: 'pay (gross)', nodeId: 'c1', role: 'field' },
      { text: ' is ', nodeId: 'c1' },
      { text: '(03)', nodeId: 'c1', role: 'value' },
    ];

    await draw({ parts: typed, marks: new Map([['c1', 'A']]) });

    expect(drawn().textContent).toBe('pay (gross) is (03)');
    expect(units().map((unit) => unit.textContent)).toEqual(['pay (gross) is (03)']);
  });

  it('draws a text of one line with no marks as it came, and reads it as it is drawn', async () => {
    await draw({ parts: SENTENCE });

    expect(host().querySelector('[data-testid="plain-text"]')).toBeNull();
    expect(host().querySelector('[data-testid="drawn-text"]')!.hasAttribute('aria-hidden')).toBe(false);
    expect(units()).toHaveLength(0);
    expect(host().querySelector('[data-tone]')).toBeNull();
  });

  it('writes the brackets of a reason as they came: they are its punctuation, not a group of a rule', async () => {
    const reason: TextPart[] = [
      { text: 'age: ', nodeId: 'c1' },
      { text: '16', nodeId: 'c1', role: 'actual' },
      { text: ' (under 18)', nodeId: 'c1' },
    ];

    await draw({ parts: reason, markValues: true });

    expect(host().textContent).toBe('age: 16 (under 18)');
    expect(units()).toHaveLength(0);
  });
});
