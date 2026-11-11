import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideTestIcons } from '../../../testing/icons';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations, t } from '../../../testing/translate';
import { ControlSummary, LastRun } from '../../core/api/api.types';
import { ControlsTableComponent } from './controls-table.component';

function control(id: number, lastRun: LastRun | null, overrides: Partial<ControlSummary> = {}): ControlSummary {
  return {
    id,
    name: `control ${id}`,
    description: `what control ${id} finds`,
    rootEntity: 'order',
    version: 1,
    isActive: true,
    createdAt: '2026-11-01T07:00:00.000Z',
    updatedAt: '2026-11-01T07:00:00.000Z',
    lastRun,
    ...overrides,
  };
}

const ran = (status: LastRun['status'], totalCount: number | null): LastRun => ({
  id: 40,
  startedAt: new Date(2026, 10, 3, 9, 12).toISOString(),
  status,
  totalCount,
});

describe('ControlsTableComponent', () => {
  let fixture: ComponentFixture<ControlsTableComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLElement>('[data-testid="control-row"]')];
  const cell = (row: HTMLElement, testId: string) => row.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  async function draw(controls: ControlSummary[], inputs: Record<string, unknown> = {}): Promise<void> {
    for (const [name, value] of Object.entries({ controls, glossary: SYNTHETIC_GLOSSARY, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ControlsTableComponent],
      providers: [provideHttpClient(), provideRouter([]), provideTestTranslations(), provideTestIcons()],
    });
    fixture = TestBed.createComponent(ControlsTableComponent);
  });

  describe('the result of the last run', () => {
    it('is a dash, said in words to assistive technology, for a control that never ran', async () => {
      await draw([control(1, null)]);

      expect(cell(rows()[0], 'last-run')!.textContent?.trim()).toBe(t('list.neverRun'));
      expect(cell(rows()[0], 'result')!.getAttribute('data-result')).toBe('never');
      expect(cell(rows()[0], 'result')!.querySelector('.sr-only')!.textContent).toBe(t('list.result.never'));
    });

    it('is the count as a link to that run when the run found violations', async () => {
      await draw([control(1, ran('succeeded', 3))]);

      const link = cell(rows()[0], 'result')!.querySelector('a')!;
      expect(link.textContent?.trim()).toBe(t('results.violations.other', { count: 3 }));
      expect(link.getAttribute('href')).toBe('/runs/40');
    });

    it('says no violations, as a success, when the run found none', async () => {
      await draw([control(1, ran('succeeded', 0))]);

      const result = cell(rows()[0], 'result')!;
      expect(result.getAttribute('data-result')).toBe('none');
      expect(result.textContent?.trim()).toBe(t('list.result.none'));
      expect(result.querySelector('a')).toBeNull();
    });

    it('says the run stopped, with a link to it, for a failed and for a timed-out run', async () => {
      await draw([control(1, ran('failed', null)), control(2, ran('timed_out', null))]);

      for (const row of rows()) {
        const link = cell(row, 'result')!.querySelector('a')!;
        expect(link.textContent?.trim()).toBe(t('list.result.stopped'));
        expect(link.getAttribute('href')).toBe('/runs/40');
      }
    });

    it('says the run is in progress while the last run has not ended', async () => {
      await draw([control(1, ran('running', null))]);

      expect(cell(rows()[0], 'result')!.textContent?.trim()).toBe(t('list.result.running'));
    });

    it('writes the day of an earlier run as a date', async () => {
      await draw([control(1, ran('succeeded', 3))]);

      expect(cell(rows()[0], 'last-run')!.textContent?.trim()).toBe('03.11.2026');
    });
  });

  it('links the name to the editor and labels the root entity from the glossary', async () => {
    await draw([control(7, null)]);

    const name = cell(rows()[0], 'control-link')!;
    expect(name.getAttribute('href')).toBe('/controls/7');
    expect(name.querySelector('bdi')!.textContent).toBe('control 7');
    expect(rows()[0].textContent).toContain(SYNTHETIC_GLOSSARY.entities[0].label.plural['he']);
  });

  it('shows a dash for the root entity when the glossary could not be read', async () => {
    await draw([control(7, null)], { glossary: null });

    expect(rows()[0].querySelectorAll('td')[1].textContent?.trim()).toBe(t('common.none'));
  });

  it('asks to run the control of the row whose button is pressed', async () => {
    const asked: number[] = [];
    fixture.componentInstance.run.subscribe((control) => asked.push(control.id));
    await draw([control(1, null), control(2, null)]);

    cell(rows()[1], 'run')!.click();

    expect(asked).toEqual([2]);
  });

  it('disables the button of a running control and says the run is on its way', async () => {
    await draw([control(1, null), control(2, null)], { running: new Set([2]) });

    const [first, second] = rows().map((row) => cell(row, 'run') as HTMLButtonElement);
    expect(first.disabled).toBe(false);
    expect(second.disabled).toBe(true);
    expect(second.textContent?.trim()).toBe(t('list.actions.running'));
  });

  it('offers only duplicate for an archived control, and marks it', async () => {
    await draw([control(1, null, { isActive: false })]);

    expect(cell(rows()[0], 'archived-chip')!.textContent).toBe(t('list.archived'));
    expect(cell(rows()[0], 'run')).toBeNull();
    expect(cell(rows()[0], 'edit')).toBeNull();
    expect(cell(rows()[0], 'duplicate')!.getAttribute('href')).toBe('/controls/new?from=1');
  });

  it('stands skeleton rows while the first page is on its way', async () => {
    await draw([], { loading: true });

    expect(rows()).toHaveLength(0);
    expect(host().querySelectorAll('[data-testid="skeleton-row"]').length).toBeGreaterThan(0);
  });
});
