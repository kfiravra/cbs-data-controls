import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideTestTranslations, t } from '../../../testing/translate';
import { ConditionSummary } from '../../core/api/api.types';
import { RunFact, RunOverviewComponent } from './run-overview.component';

const clause = (id: string, text: string) => ({ id, sentence: text, sentenceParts: [{ text, nodeId: id }] });
const CONDITIONS: ConditionSummary[] = [
  { ...clause('c1', 'ends before it starts'), count: 9 },
  { ...clause('c2', 'age under 16'), count: 1500 },
  { ...clause('c3', 'not counted') },
];
const MARKS = new Map([
  ['c1', 'A'],
  ['c2', 'B'],
  ['c3', 'C'],
]);
const FACTS: RunFact[] = [
  { label: 'checked', text: 'orders' },
  { label: 'took', text: '2 seconds' },
];

describe('RunOverviewComponent', () => {
  let fixture: ComponentFixture<RunOverviewComponent>;
  let filters: (string | null)[];
  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLButtonElement>('[data-testid="breakdown-row"]')];
  const all = () => host().querySelector<HTMLButtonElement>('[data-testid="breakdown-all"]');
  const figure = () => host().querySelector<HTMLElement>('.overview__figure')!;

  async function draw(inputs: Record<string, unknown> = {}): Promise<void> {
    const defaults = { figure: '6,000', noun: 'violations', total: 6000, facts: FACTS, conditions: CONDITIONS, marks: MARKS };
    for (const [name, value] of Object.entries({ ...defaults, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RunOverviewComponent],
      providers: [provideHttpClient(), provideRouter([]), provideTestTranslations()],
    });
    fixture = TestBed.createComponent(RunOverviewComponent);
    filters = [];
    fixture.componentInstance.filter.subscribe((id) => filters.push(id));
  });

  it('says the count once, with its noun, and the facts of the run as terms and values', async () => {
    await draw();

    expect(host().querySelector('[data-testid="run-total"]')!.textContent).toBe('6,000');
    expect(figure().textContent?.replace(/\s+/g, ' ').trim()).toBe('6,000 violations');
    expect([...host().querySelectorAll('dt')].map((term) => term.textContent)).toEqual(['checked', 'took']);
    expect([...host().querySelectorAll('dd')].map((value) => value.textContent?.trim())).toEqual(['orders', '2 seconds']);
    // the chip for all violations names them and repeats no number
    expect(all()!.textContent?.trim()).toBe(t('results.breakdown.all'));
  });

  it('links the count of the earlier run to that run', async () => {
    await draw({ previous: { label: 'the run before', text: '5,990 violations', link: ['/runs', 40] } });

    const link = host().querySelector<HTMLAnchorElement>('[data-testid="previous-run"]')!;
    expect(link.textContent).toBe('5,990 violations');
    expect(link.getAttribute('href')).toBe('/runs/40');
  });

  it('draws one chip per condition that carries a count, with its mark, its clause and the count', async () => {
    await draw();

    expect(rows().map((row) => row.getAttribute('data-node'))).toEqual(['c1', 'c2']);
    expect(rows().map((row) => row.querySelector('[data-testid="mark"]')!.textContent)).toEqual(['A', 'B']);
    expect(rows()[0].textContent).toContain('ends before it starts');
    expect(rows()[1].querySelector('[data-testid="breakdown-count"]')!.textContent).toBe('1,500');
    // a bare number at the end of a button says nothing aloud: the count is also there with its noun
    expect(rows()[0].querySelector('.sr-only')!.textContent).toBe(t('results.violations.other', { count: 9 }));
  });

  it('gives the letter on each chip the colour of its condition, by the order of the marks', async () => {
    await draw();

    // c3 carries no count and has no chip, yet keeps its place in the order: the colours do not shift
    expect(rows().map((row) => row.querySelector('[data-testid="mark"]')!.getAttribute('data-tone'))).toEqual(['1', '2']);
    await draw({ marks: new Map([['c0', 'A'], ['c1', 'B'], ['c2', 'C']]) });
    expect(rows().map((row) => row.querySelector('[data-testid="mark"]')!.getAttribute('data-tone'))).toEqual(['2', '3']);
  });

  it('draws no mark, and no empty box in its place, for a condition whose mark is not known', async () => {
    await draw({ marks: new Map([['c1', 'A']]) });

    expect(rows().map((row) => row.querySelectorAll('[data-testid="mark"]').length)).toEqual([1, 0]);
    expect(rows()[1].textContent).toContain('age under 16');
  });

  it('has no count by condition, and marks the count as clean, for a run that found nothing', async () => {
    await draw({ figure: '0', total: 0 });

    expect(all()).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(figure().classList).toContain('overview__figure--clean');
  });

  it('filters by the condition of the chip that is pressed, and by nothing when it is pressed again', async () => {
    await draw();
    expect(figure().classList).not.toContain('overview__figure--clean');
    rows()[1].click();
    expect(filters).toEqual(['c2']);

    await draw({ active: 'c2' });
    rows()[1].click();
    all()!.click();

    expect(filters).toEqual(['c2', null, null]);
  });

  it('shows which chip filters by pressing it, and leaves every mark as it is: a mark is a badge', async () => {
    await draw();
    expect(all()!.getAttribute('aria-pressed')).toBe('true');

    await draw({ active: 'c1' });
    rows()[1].dispatchEvent(new Event('pointerenter'));
    rows()[1].dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();

    expect(all()!.getAttribute('aria-pressed')).toBe('false');
    expect(rows().map((row) => row.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(rows().map((row) => row.querySelector('[data-testid="mark"]')!.getAttribute('data-state'))).toEqual([
      'resting',
      'resting',
    ]);
  });
});
