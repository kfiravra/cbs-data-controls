import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { provideTestIcons } from '../../../testing/icons';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations, t } from '../../../testing/translate';
import { ResultItem } from '../../core/api/api.types';
import { DisplaySort, ResultColumn, ResultsTableComponent } from './results-table.component';

const fields = SYNTHETIC_GLOSSARY.entities[0].fields;
const COLUMNS: ResultColumn[] = ['reference', 'order_number'].map((key) => {
  const field = fields.find((candidate) => candidate.key === key)!;
  return { key, field, label: field.label['he'] };
});

// shapes of contracts/api.md §5: a record with its identifying fields and one reason per matched node
const ROWS: ResultItem[] = [
  {
    seq: 1,
    key: '10432',
    display: { reference: 'north-7', order_number: 10432 },
    matched: ['c1', 'c2'],
    reasons: [
      {
        conditionId: 'c1',
        reasonKey: 'above',
        params: {},
        text: 'total: 16,500 (above 15,000)',
        textParts: [
          { text: 'total', nodeId: 'c1', role: 'field' },
          { text: ': ', nodeId: 'c1' },
          { text: '16,500', nodeId: 'c1', role: 'actual' },
          { text: ' (above ', nodeId: 'c1' },
          { text: '15,000', nodeId: 'c1', role: 'value' },
          { text: ')', nodeId: 'c1' },
        ],
      },
      {
        conditionId: 'c2',
        reasonKey: 'absent',
        params: {},
        text: 'reference: absent',
        textParts: [
          { text: 'reference', nodeId: 'c2', role: 'field' },
          { text: ': absent', nodeId: 'c2' },
        ],
      },
    ],
    reasonText: 'total: 16,500 (above 15,000); reference: absent',
  },
  {
    seq: 2,
    key: '7',
    display: { reference: null, order_number: 7 },
    matched: ['c2'],
    reasons: [
      { conditionId: 'c2', reasonKey: 'absent', params: {}, text: 'x', textParts: [{ text: 'x', nodeId: 'c2' }] },
    ],
    reasonText: 'x',
  },
];
const MARKS = new Map([
  ['c1', 'A'],
  ['c2', 'B'],
]);

describe('ResultsTableComponent', () => {
  let fixture: ComponentFixture<ResultsTableComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLElement>('[data-testid="result-row"]')];
  const reasons = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[data-testid="reason"]')];

  async function draw(inputs: Record<string, unknown> = {}): Promise<void> {
    for (const [name, value] of Object.entries({ rows: ROWS, columns: COLUMNS, marks: MARKS, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ResultsTableComponent],
      providers: [provideHttpClient(), provideTestTranslations(), provideTestIcons()],
    });
    fixture = TestBed.createComponent(ResultsTableComponent);
  });

  it('heads a column per identifying field, then the reasons', async () => {
    await draw();

    const heads = [...host().querySelectorAll('th')].map((head) => head.textContent?.trim());
    expect(heads).toEqual([...COLUMNS.map((column) => column.label), t('results.table.reasons')]);
  });

  it('writes the identifying fields of each record, isolated from the direction of the page', async () => {
    await draw();

    const cells = [...rows()[0].querySelectorAll('td')].slice(0, 2);
    expect(cells.map((cell) => cell.querySelector('bdi')?.textContent)).toEqual(['north-7', '10432']);
  });

  it('writes a number that names a record digit for digit, and nothing for a missing value', async () => {
    await draw();

    expect(rows()[0].querySelectorAll('td')[1].textContent?.trim()).toBe('10432');
    expect(rows()[1].querySelectorAll('td')[0].textContent?.trim()).toBe('');
  });

  it('gives each reason the mark of its condition, in the order the record matched them', async () => {
    await draw();

    const marksOf = (row: HTMLElement) => reasons(row).map((reason) => reason.querySelector('[data-testid="mark"]')!.textContent);
    expect(marksOf(rows()[0])).toEqual(['A', 'B']);
    expect(marksOf(rows()[1])).toEqual(['B']);
  });

  it('marks the actual value inside its reason and draws the rest of the engine text as written', async () => {
    await draw();

    const [first, second] = reasons(rows()[0]);
    expect([...first.querySelectorAll('[data-testid="value"]')].map((value) => value.textContent)).toEqual(['16,500']);
    expect(first.querySelector('span:last-child')!.textContent).toBe('total: 16,500 (above 15,000)');
    expect(second.querySelector('[data-testid="value"]')).toBeNull();
  });

  it('draws a reason without a mark, and without an empty box, when the marks of the run are not known', async () => {
    await draw({ marks: new Map() });

    const [first] = reasons(rows()[0]);
    expect(first.querySelector('[data-testid="mark"]')).toBeNull();
    expect(first.textContent).toContain('total: 16,500 (above 15,000)');
  });

  it('names each reason mark as its condition, because a reason line has no other name for it', async () => {
    await draw();

    const mark = reasons(rows()[0])[0].querySelector('[data-testid="mark"]')!;
    expect(mark.getAttribute('aria-label')).toBe(t('common.condition', { mark: 'A' }));
  });

  it('shows the traced and the filtering condition on the marks of its reasons', async () => {
    await draw({ traced: 'c1', active: 'c2' });

    const states = reasons(rows()[0]).map((reason) => reason.querySelector('[data-testid="mark"]')!.getAttribute('data-state'));
    expect(states).toEqual(['traced', 'active']);
  });

  it('sorts by the first column: ascending, descending, then the order of the run again', async () => {
    const asked: DisplaySort[] = [];
    fixture.componentInstance.sortChange.subscribe((sort) => asked.push(sort));
    const button = () => host().querySelector<HTMLButtonElement>('[data-testid="sort-display"]')!;
    const head = () => host().querySelector('th')!;

    await draw();
    expect(head().getAttribute('aria-sort')).toBe('none');
    button().click();

    await draw({ sort: 'asc' });
    expect(head().getAttribute('aria-sort')).toBe('ascending');
    button().click();

    await draw({ sort: 'desc' });
    expect(head().getAttribute('aria-sort')).toBe('descending');
    button().click();

    expect(asked).toEqual(['asc', 'desc', null]);
  });

  it('stands skeleton rows in the shape of the table while rows are on their way', async () => {
    await draw({ loading: true });

    expect(rows()).toHaveLength(0);
    expect(host().querySelectorAll('[data-testid="skeleton-row"]').length).toBeGreaterThan(0);
    expect(host().querySelector('table')!.getAttribute('aria-busy')).toBe('true');
  });

  it('says which condition is under the pointer on a reason', async () => {
    await draw();
    const traced: (string | null)[] = [];
    fixture.componentInstance.trace.subscribe((id) => traced.push(id));

    reasons(rows()[0])[1].dispatchEvent(new Event('pointerenter'));
    reasons(rows()[0])[1].dispatchEvent(new Event('pointerleave'));

    expect(traced).toEqual(['c2', null]);
  });
});
