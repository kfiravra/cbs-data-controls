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

  it('opens each clause with its mark, bound to the first word of the clause', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });

    // the mark is placed over the start of the word and takes no room: no space stands between the two
    const bound = [...host().querySelectorAll('.nb.marked')].map((element) => element.textContent);
    expect(bound).toEqual(['Aage', 'Bmonthly']);
    expect(bound.map((_, index) => host().querySelectorAll('.nb.marked')[index].firstElementChild?.tagName)).toEqual(['APP-MARK', 'APP-MARK']);
    expect(host().textContent).toBe('Aage under 18 and Bmonthly salary over 15,000');
  });

  it('names each mark as its condition, because nothing else in a sentence names it', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });

    expect(marks().map((mark) => mark.getAttribute('aria-label'))).toEqual([
      t('common.condition', { mark: 'A' }),
      t('common.condition', { mark: 'B' }),
    ]);
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

  it('outlines the mark of an open condition and leaves the others as badges', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });
    expect(marks().map((mark) => mark.className)).toEqual(['mark', 'mark']);

    await draw({ open: new Set(['c1']) });
    expect(marks().map((mark) => mark.className)).toEqual(['mark mark--open', 'mark']);
  });

  it('answers nothing to the pointer: a clause and its mark stay as they are under it', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });
    const clause = host().querySelector('[data-node="c2"]')!;

    clause.dispatchEvent(new Event('pointerenter'));
    await fixture.whenStable();

    expect(marks().map((mark) => mark.getAttribute('data-state'))).toEqual(['resting', 'resting']);
  });

  it('gives a node one mark when its clause is split around the clauses inside it, and draws its brackets as a block', async () => {
    const related: TextPart[] = [
      { text: 'no ', nodeId: 'r1' },
      { text: 'line', nodeId: 'r1', role: 'relationship' },
      { text: ' with (', nodeId: 'r1' },
      { text: 'quantity', nodeId: 'c2', role: 'field' },
      { text: ' over 3', nodeId: 'c2' },
      { text: ')', nodeId: 'r1' },
    ];

    await draw({ parts: related, marks: new Map([['r1', 'A'], ['c2', 'B']]) });

    expect(marks().map((mark) => mark.textContent)).toEqual(['A', 'B']);
    // on the screen no bracket: what stood in them is one block, and the text runs on as one sentence
    const drawn = host().querySelector('[data-testid="drawn-text"]')!;
    expect(drawn.textContent).toBe('Ano line with Bquantity over 3');
    expect([...drawn.querySelectorAll('[data-testid="rule-group"]')].map((group) => group.textContent)).toEqual(['Bquantity over 3']);
    expect(drawn.querySelector('.rule-line')).toBeNull();
    // to be read: the engine's sentence as it wrote it, and the drawing is not read twice
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe('no line with (quantity over 3)');
    expect(drawn.getAttribute('aria-hidden')).toBe('true');
  });

  it('stands each group of the top level on a line of its own, with the joining word between, and nests a group as a block in a block', async () => {
    const nested: TextPart[] = [
      { text: '(' },
      { text: 'state: open', nodeId: 'c1' },
      { text: ' and ' },
      { text: '(' },
      { text: 'mail: empty', nodeId: 'c2' },
      { text: ' or ' },
      { text: 'pay: missing', nodeId: 'c3' },
      { text: ')' },
      { text: ')' },
      { text: ' or ' },
      { text: '(' },
      { text: 'state: closed', nodeId: 'c4' },
      { text: ')' },
    ];

    await draw({ parts: nested, marks: new Map([['c1', 'A'], ['c2', 'B'], ['c3', 'C'], ['c4', 'D']]) });

    const drawn = host().querySelector('[data-testid="drawn-text"]')!;
    const lines = [...drawn.children];
    expect(lines.map((line) => line.className)).toEqual(['rule-line', 'rule-joiner', 'rule-line']);
    expect(lines.map((line) => line.textContent?.trim())).toEqual([
      'Astate: open and Bmail: empty or Cpay: missing',
      'or',
      'Dstate: closed',
    ]);
    // the inner group is a block inside the first line's block
    const outer = lines[0].querySelector('[data-testid="rule-group"]')!;
    expect(outer.querySelector('[data-testid="rule-group"]')!.textContent).toBe('Bmail: empty or Cpay: missing');
    expect(drawn.textContent).not.toMatch(/[()]/);
    expect(host().querySelector('[data-testid="plain-text"]')!.textContent).toBe(
      '(state: open and (mail: empty or pay: missing)) or (state: closed)',
    );
  });

  it('draws a text without brackets as before: one run of clauses, read as it is drawn', async () => {
    await draw({ parts: SENTENCE, marks: MARKS });

    expect(host().querySelector('[data-testid="plain-text"]')).toBeNull();
    expect(host().querySelector('[data-testid="drawn-text"]')!.hasAttribute('aria-hidden')).toBe(false);
    expect(host().querySelector('[data-testid="rule-group"]')).toBeNull();
  });

  it('writes the brackets of a reason as they came: they are its punctuation, not a group of a rule', async () => {
    const reason: TextPart[] = [
      { text: 'age: ', nodeId: 'c1' },
      { text: '16', nodeId: 'c1', role: 'actual' },
      { text: ' (under 18)', nodeId: 'c1' },
    ];

    await draw({ parts: reason, markValues: true });

    expect(host().textContent).toBe('age: 16 (under 18)');
    expect(host().querySelector('[data-testid="rule-group"]')).toBeNull();
  });
});
