import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestTranslations, t } from '../../../testing/translate';
import { ConditionSummary } from '../../core/api/api.types';
import { BreakdownComponent } from './breakdown.component';

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

describe('BreakdownComponent', () => {
  let fixture: ComponentFixture<BreakdownComponent>;
  let filters: (string | null)[];
  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLButtonElement>('[data-testid="breakdown-row"]')];
  const all = () => host().querySelector<HTMLButtonElement>('[data-testid="breakdown-all"]')!;

  async function draw(inputs: Record<string, unknown> = {}): Promise<void> {
    for (const [name, value] of Object.entries({ conditions: CONDITIONS, total: 6000, marks: MARKS, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BreakdownComponent],
      providers: [provideHttpClient(), provideTestTranslations()],
    });
    fixture = TestBed.createComponent(BreakdownComponent);
    filters = [];
    fixture.componentInstance.filter.subscribe((id) => filters.push(id));
  });

  it('draws a row for all violations and one per condition that carries a count, with its mark and clause', async () => {
    await draw();

    expect(all().textContent).toContain(t('results.breakdown.all'));
    expect(all().textContent).toContain('6,000');
    expect(rows().map((row) => row.getAttribute('data-node'))).toEqual(['c1', 'c2']);
    expect(rows().map((row) => row.querySelector('[data-testid="mark"]')!.textContent)).toEqual(['A', 'B']);
    expect(rows()[0].textContent).toContain('ends before it starts');
    expect(rows()[1].querySelector('[data-testid="breakdown-count"]')!.textContent).toBe('1,500');
  });

  it('draws no mark, and no empty box in its place, for a condition whose mark is not known', async () => {
    await draw({ marks: new Map([['c1', 'A']]) });

    expect(rows().map((row) => row.querySelectorAll('[data-testid="mark"]').length)).toEqual([1, 0]);
    expect(rows()[1].textContent).toContain('age under 16');
  });

  it('gives each row its share of all violations as the length of its bar', async () => {
    await draw();

    expect(rows().map((row) => row.style.getPropertyValue('--share'))).toEqual(['0.0015', '0.25']);
  });

  it('never draws a bar longer than the whole, whatever the counts say', async () => {
    await draw({ total: 3 });

    expect(rows()[1].style.getPropertyValue('--share')).toBe('1');
  });

  it('filters by the condition of the row that is pressed, and by nothing when it is pressed again', async () => {
    await draw();
    rows()[1].click();
    expect(filters).toEqual(['c2']);

    await draw({ active: 'c2' });
    rows()[1].click();
    all().click();

    expect(filters).toEqual(['c2', null, null]);
  });

  it('shows which row filters by pressing it, and leaves every mark as it is: a mark is a badge', async () => {
    await draw();
    expect(all().getAttribute('aria-pressed')).toBe('true');

    await draw({ active: 'c1' });
    rows()[1].dispatchEvent(new Event('pointerenter'));
    rows()[1].dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();

    expect(all().getAttribute('aria-pressed')).toBe('false');
    expect(rows().map((row) => row.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(rows().map((row) => row.querySelector('[data-testid="mark"]')!.getAttribute('data-state'))).toEqual([
      'resting',
      'resting',
    ]);
  });
});
