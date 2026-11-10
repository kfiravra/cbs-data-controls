import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestIcons } from '../../../testing/icons';
import { ToolbarComponent } from './toolbar.component';

describe('ToolbarComponent', () => {
  let fixture: ComponentFixture<ToolbarComponent>;
  let emitted: string[];
  const host = () => fixture.nativeElement as HTMLElement;
  const type = (text: string) => {
    const input = host().querySelector<HTMLInputElement>('[data-testid="toolbar-search"]')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ToolbarComponent], providers: [provideTestIcons()] });
    fixture = TestBed.createComponent(ToolbarComponent);
    fixture.componentRef.setInput('searchLabel', 'search');
    emitted = [];
    fixture.componentInstance.searchChange.subscribe((text) => emitted.push(text));
    await vi.runOnlyPendingTimersAsync();
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('emits the search once, 300ms after the last key', () => {
    type('le');
    vi.advanceTimersByTime(200);
    type('lev');
    vi.advanceTimersByTime(299);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitted).toEqual(['lev']);
  });

  it('emits the same term again when it is typed after the search was cleared from outside', () => {
    type('levi');
    vi.advanceTimersByTime(300);
    fixture.componentRef.setInput('search', '');
    fixture.detectChanges();

    type('levi');
    vi.advanceTimersByTime(300);

    expect(emitted).toEqual(['levi', 'levi']);
  });

  it('has no filter button when it has no filters', () => {
    expect(host().querySelector('[data-testid="toolbar-filters-toggle"]')).toBeNull();
  });

  it('opens and closes its filters from one named button', () => {
    fixture.componentRef.setInput('filtersLabel', 'filters');
    fixture.detectChanges();
    const toggle = host().querySelector<HTMLButtonElement>('[data-testid="toolbar-filters-toggle"]')!;

    expect(toggle.getAttribute('aria-label')).toBe('filters');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
