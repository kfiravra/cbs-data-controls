import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestIcons } from '../../../testing/icons';
import { SortHeaderComponent, ariaSort } from './sort-header.component';

describe('SortHeaderComponent', () => {
  let fixture: ComponentFixture<SortHeaderComponent>;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!;

  async function draw(inputs: Record<string, unknown> = {}): Promise<void> {
    for (const [name, value] of Object.entries({ label: 'last run', ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SortHeaderComponent], providers: [provideTestIcons()] });
    fixture = TestBed.createComponent(SortHeaderComponent);
  });

  it('names the column on a button, and asks to sort when it is pressed', async () => {
    let asked = 0;
    fixture.componentInstance.sort.subscribe(() => asked++);
    await draw();

    button().click();

    expect(button().textContent?.trim()).toBe('last run');
    expect(button().type).toBe('button');
    expect(asked).toBe(1);
  });

  it('says how its column sorts now, and nothing when another column does', async () => {
    await draw();
    expect(button().getAttribute('data-sort')).toBeNull();

    await draw({ sorted: 'asc' });
    expect(button().getAttribute('data-sort')).toBe('asc');

    await draw({ sorted: 'desc' });
    expect(button().getAttribute('data-sort')).toBe('desc');
  });

  it('carries the test id it is given, so two tables tell their heads apart', async () => {
    await draw({ testId: 'sort-display' });

    expect(button().getAttribute('data-testid')).toBe('sort-display');
  });

  it('gives the words of aria-sort for a header cell', () => {
    expect([ariaSort('asc'), ariaSort('desc'), ariaSort(null)]).toEqual(['ascending', 'descending', 'none']);
  });
});
