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
    const chip = (row: HTMLElement) => cell(row, 'status-chip')!;

    it('says a control never ran in the grey of what has no result, with a dash where its run would be dated', async () => {
      await draw([control(1, null)]);

      expect(cell(rows()[0], 'last-run')!.textContent?.trim()).toBe(t('common.none'));
      expect(cell(rows()[0], 'result')!.getAttribute('data-result')).toBe('never');
      expect(chip(rows()[0]).textContent?.trim()).toBe(t('list.neverRun'));
      expect(chip(rows()[0]).className).toBe('status-chip');
    });

    it('is the count, in the red of violations, when the run found some', async () => {
      await draw([control(1, ran('succeeded', 3))]);

      expect(chip(rows()[0]).textContent?.trim()).toBe(t('results.violations.other', { count: 3 }));
      expect(chip(rows()[0]).classList).toContain('status-chip--violations');
    });

    it('says no violations, in the green of a clean run, when the run found none', async () => {
      await draw([control(1, ran('succeeded', 0))]);

      expect(cell(rows()[0], 'result')!.getAttribute('data-result')).toBe('none');
      expect(chip(rows()[0]).textContent?.trim()).toBe(t('list.result.none'));
      expect(chip(rows()[0]).classList).toContain('status-chip--clean');
    });

    it('says the run stopped, in amber, for a failed and for a timed-out run', async () => {
      await draw([control(1, ran('failed', null)), control(2, ran('timed_out', null))]);

      for (const row of rows()) {
        expect(chip(row).textContent?.trim()).toBe(t('list.result.stopped'));
        expect(chip(row).classList).toContain('status-chip--stopped');
      }
    });

    it('says the run is in progress while the last run has not ended', async () => {
      await draw([control(1, ran('running', null))]);

      expect(cell(rows()[0], 'result')!.textContent?.trim()).toBe(t('list.result.running'));
    });

    it('keeps the words and drops the colour for an archived control, whatever its run found', async () => {
      const archived = { isActive: false };
      await draw([control(1, ran('succeeded', 3), archived), control(2, ran('succeeded', 0), archived)], { archived: true });

      expect(rows().map((row) => chip(row).textContent?.trim())).toEqual([
        t('results.violations.other', { count: 3 }),
        t('list.result.none'),
      ]);
      expect(rows().map((row) => chip(row).className)).toEqual(['status-chip', 'status-chip']);
    });

    it('writes the day of an earlier run as a date', async () => {
      await draw([control(1, ran('succeeded', 3))]);

      expect(cell(rows()[0], 'last-run')!.textContent?.trim()).toBe('03.11.2026');
    });
  });

  describe('the head', () => {
    const heads = () => [...host().querySelectorAll<HTMLElement>('thead th')];
    const buttons = () => [...host().querySelectorAll<HTMLButtonElement>('[data-testid="sort-header"]')];

    it('names every column of the details on a button that asks to sort by it', async () => {
      const asked: string[] = [];
      fixture.componentInstance.sortChange.subscribe((column) => asked.push(column));
      await draw([control(1, null)]);

      expect(buttons().map((button) => button.textContent?.trim())).toEqual(
        ['control', 'checked', 'lastRun', 'result'].map((column) => t(`list.columns.${column}`)),
      );
      buttons().forEach((button) => button.click());

      expect(asked).toEqual(['name', 'rootEntity', 'lastRun', 'violations']);
    });

    it('says which column the list is sorted by, and which way, on its header cell', async () => {
      await draw([control(1, null)], { sort: 'lastRun', dir: 'desc' });

      expect(heads().map((head) => head.getAttribute('aria-sort'))).toEqual(['none', 'none', 'descending', 'none', null, null]);
      expect(buttons().map((button) => button.getAttribute('data-sort'))).toEqual([null, null, 'desc', null]);
    });

    it('has no column for a run button in the archive', async () => {
      await draw([control(1, null, { isActive: false })], { archived: true });

      expect(heads()).toHaveLength(5);
      expect(rows()[0].querySelector('.cell-run')).toBeNull();
    });
  });

  it('links the name to the results of the last run, and the pencil to the editor', async () => {
    await draw([control(7, ran('succeeded', 3))]);

    const name = cell(rows()[0], 'control-link')!;
    expect(name.getAttribute('href')).toBe('/runs/40');
    expect(name.querySelector('bdi')!.textContent).toBe('control 7');
    expect(cell(rows()[0], 'edit')!.getAttribute('href')).toBe('/controls/7');
  });

  it('has one link in the details of a row, and says where it leads: the whole of the details is that link', async () => {
    await draw([control(7, ran('succeeded', 3)), control(8, null)]);

    for (const row of rows()) {
      const details = [...row.querySelectorAll('td:not(.cell-run, .cell-actions)')];
      expect(details.flatMap((part) => [...part.querySelectorAll('a, button')])).toEqual([cell(row, 'control-link')]);
    }
    const described = rows().map(
      (row) => host().querySelector(`#${cell(row, 'control-link')!.getAttribute('aria-describedby')}`)!.textContent,
    );
    expect(described).toEqual([t('list.actions.openResults'), t('list.actions.openControl')]);
  });

  it('links the name of a control that never ran to the control\'s own results, where it can be run', async () => {
    await draw([control(7, null)]);

    expect(cell(rows()[0], 'control-link')!.getAttribute('href')).toBe('/controls/7/runs');
  });

  it('labels what the control checks from the glossary', async () => {
    await draw([control(7, null)]);

    expect(rows()[0].textContent).toContain(SYNTHETIC_GLOSSARY.entities[0].label.plural['he']);
  });

  it('shows a dash for what the control checks when the glossary could not be read', async () => {
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

  it('marks the button of a running control as unavailable, keeps it focusable, and says the run is on its way', async () => {
    await draw([control(1, null), control(2, null)], { running: new Set([2]) });

    const [first, second] = rows().map((row) => cell(row, 'run') as HTMLButtonElement);
    expect(first.hasAttribute('aria-disabled')).toBe(false);
    expect(second.getAttribute('aria-disabled')).toBe('true');
    // a disabled button would drop the focus it holds when the run starts
    expect(second.disabled).toBe(false);
    expect(second.textContent?.trim()).toBe(t('list.actions.running'));
  });

  it('describes the run button of a row by the name of its control', async () => {
    await draw([control(1, ran('succeeded', 3)), control(2, ran('succeeded', 0))]);

    for (const row of rows()) {
      const name = cell(row, 'control-link')!;
      expect(name.id).toMatch(/^control-\d+$/);
      expect(cell(row, 'run')!.getAttribute('aria-describedby')).toBe(name.id);
    }
  });

  it('asks to archive the control of the row whose archive button is pressed, and names the button by the control', async () => {
    const asked: number[] = [];
    fixture.componentInstance.archive.subscribe((control) => asked.push(control.id));
    await draw([control(1, null), control(2, null)]);

    const button = cell(rows()[1], 'archive')!;
    button.click();

    expect(asked).toEqual([2]);
    expect(button.getAttribute('aria-label')).toBe(t('list.actions.archiveNamed', { name: 'control 2' }));
  });

  it('offers only duplicate for an archived control: it cannot be run, edited or archived again', async () => {
    await draw([control(1, ran('succeeded', 3), { isActive: false })], { archived: true });

    // the row still opens the results of its last run
    expect(cell(rows()[0], 'control-link')!.getAttribute('href')).toBe('/runs/40');

    expect(cell(rows()[0], 'run')).toBeNull();
    expect(cell(rows()[0], 'edit')).toBeNull();
    expect(cell(rows()[0], 'archive')).toBeNull();
    expect(cell(rows()[0], 'duplicate')!.getAttribute('href')).toBe('/controls/new?from=1');
  });

  it('stands skeleton rows while the first page is on its way', async () => {
    await draw([], { loading: true });

    expect(rows()).toHaveLength(0);
    expect(host().querySelectorAll('[data-testid="skeleton-row"]').length).toBeGreaterThan(0);
  });
});
