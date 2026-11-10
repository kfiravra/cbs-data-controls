import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestIcons } from '../../../testing/icons';
import { provideTestTranslations, t } from '../../../testing/translate';
import { TableFootComponent } from './table-foot.component';

describe('TableFootComponent', () => {
  let fixture: ComponentFixture<TableFootComponent>;
  let ref: ComponentRef<TableFootComponent>;

  const text = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();
  const button = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TableFootComponent],
      providers: [provideTestTranslations(), provideTestIcons()],
    });
    fixture = TestBed.createComponent(TableFootComponent);
    ref = fixture.componentRef;
    ref.setInput('rangeKey', 'results.range');
    ref.setInput('total', 23);
    ref.setInput('page', 1);
    ref.setInput('pageSize', 10);
    await fixture.whenStable();
  });

  it('disables previous on the first page and offers next when rows remain', () => {
    expect(button('page-previous').disabled).toBe(true);
    expect(button('page-next').disabled).toBe(false);
  });

  it('disables next on the last page when the total is not a whole number of pages', async () => {
    ref.setInput('page', 3);
    await fixture.whenStable();

    expect(button('page-next').disabled).toBe(true);
    expect(button('page-previous').disabled).toBe(false);
  });

  it('emits the neighbouring page when previous or next is pressed', async () => {
    ref.setInput('page', 2);
    await fixture.whenStable();
    const pages: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));

    button('page-next').click();
    button('page-previous').click();

    expect(pages).toEqual([3, 1]);
  });

  it('writes the range in words as first row, last row and total when a middle page is shown', async () => {
    ref.setInput('rangeKey', 'results.range');
    ref.setInput('page', 3);
    await fixture.whenStable();

    expect(text('table-range')).toBe(t('results.range', { from: 21, to: 23, total: 23 }));
  });
});
