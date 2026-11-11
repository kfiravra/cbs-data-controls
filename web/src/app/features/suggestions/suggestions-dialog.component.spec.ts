import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { provideTestIcons } from '../../../testing/icons';
import { provideTestTranslations, t } from '../../../testing/translate';
import { SuggestionItem } from '../../core/api/api.types';
import { problemInterceptor } from '../../core/http/problem.interceptor';
import { SuggestionsOutcome } from '../../core/suggestions/suggestions-opener';
import { SuggestionsDialogComponent } from './suggestions-dialog.component';

function item(name: string): SuggestionItem {
  return {
    name,
    description: `${name} description`,
    rationale: `${name} rationale`,
    evidence: [{ key: 'violations_found', params: { count: 3, total: 85 }, text: `${name}: 3 of 85` }],
    definition: {
      schemaVersion: 1,
      rootEntity: 'order',
      where: {
        type: 'group',
        op: 'and',
        children: [{ type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'absent' }],
      },
    },
    sentence: `${name} sentence`,
    sentenceParts: [{ text: `${name} sentence`, nodeId: 'c1' }],
  };
}

const ITEMS = [item('first'), item('second'), item('third')];

describe('SuggestionsDialogComponent', () => {
  let fixture: ComponentFixture<SuggestionsDialogComponent>;
  let http: HttpTestingController;
  let closed: SuggestionsOutcome[];
  let ref: { disableClose: boolean; close: (outcome: SuggestionsOutcome) => void };
  const host = () => fixture.nativeElement as HTMLElement;
  const drafts = () => [...host().querySelectorAll<HTMLElement>('[data-testid="suggestion"]')];
  const createButton = () => host().querySelector<HTMLButtonElement>('[data-testid="suggestions-create"]')!;

  async function next(url: string): Promise<TestRequest> {
    for (let turn = 0; turn < 50; turn++) {
      const [found] = http.match(url);
      if (found) {
        return found;
      }
      await Promise.resolve();
    }
    throw new Error(`no request to ${url}`);
  }

  /** Lets the promises behind an answered request run, then the screen draw what they changed. */
  async function settled(): Promise<void> {
    for (let turn = 0; turn < 10; turn++) {
      await Promise.resolve();
    }
    await fixture.whenStable();
  }

  async function opened(items: SuggestionItem[] = ITEMS): Promise<void> {
    fixture = TestBed.createComponent(SuggestionsDialogComponent);
    fixture.detectChanges();
    (await next('/api/v1/suggestions')).flush({ items });
    await settled();
  }

  async function tick(index: number): Promise<void> {
    drafts()[index].querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await settled();
  }

  beforeEach(() => {
    closed = [];
    ref = { disableClose: false, close: (outcome) => closed.push(outcome) };
    TestBed.configureTestingModule({
      imports: [SuggestionsDialogComponent],
      providers: [
        provideHttpClient(withInterceptors([problemInterceptor])),
        provideHttpClientTesting(),
        provideTestTranslations(),
        provideTestIcons(),
        { provide: MatDialogRef, useFactory: () => ref },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for suggestions when it opens and shows skeleton bars meanwhile', async () => {
    fixture = TestBed.createComponent(SuggestionsDialogComponent);
    fixture.detectChanges();

    expect(host().querySelector('[data-testid="suggestions-loading"]')).not.toBeNull();
    const request = await next('/api/v1/suggestions');
    expect(request.request.method).toBe('POST');
    request.flush({ items: ITEMS });
    await settled();

    expect(host().querySelector('[data-testid="suggestions-loading"]')).toBeNull();
    expect(drafts()).toHaveLength(3);
  });

  it('shows each draft with its name, its sentence under a mark, its rationale and its evidence, none ticked', async () => {
    await opened();

    const first = drafts()[0];
    expect(first.textContent).toContain('first');
    expect(first.querySelector('[data-testid="suggestion-sentence"]')!.textContent).toContain('first sentence');
    expect(first.querySelectorAll('[data-testid="mark"]')).toHaveLength(1);
    expect(first.textContent).toContain('first rationale');
    expect(first.querySelector('[data-testid="evidence"]')!.textContent).toBe('first: 3 of 85');
    expect(host().querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0);
  });

  it('counts the selection on the main button, and disables it while nothing is ticked', async () => {
    await opened();
    expect(createButton().disabled).toBe(true);
    expect(createButton().textContent?.trim()).toBe(t('suggestions.create.none'));

    await tick(0);
    expect(createButton().disabled).toBe(false);
    expect(createButton().textContent?.trim()).toBe(t('suggestions.create.one'));

    await tick(2);
    expect(createButton().textContent?.trim()).toBe(t('suggestions.create.other', { count: 2 }));

    await tick(0);
    expect(createButton().textContent?.trim()).toBe(t('suggestions.create.one'));
  });

  it('creates the ticked drafts, in their order, and closes saying how many were created', async () => {
    await opened();
    await tick(2);
    await tick(0);

    createButton().click();
    const request = await next('/api/v1/suggestions/accept');
    expect(request.request.body).toEqual({
      items: [ITEMS[0], ITEMS[2]].map(({ name, description, definition }) => ({ name, description, definition })),
    });
    request.flush({ items: [{ id: 1 }, { id: 2 }] }, { status: 201, statusText: 'Created' });
    await settled();

    expect(closed).toEqual([{ kind: 'created', count: 2 }]);
  });

  it('cannot be closed while the selection is being created, so its outcome is never lost', async () => {
    await opened();
    await tick(0);

    createButton().click();
    const request = await next('/api/v1/suggestions/accept');
    await settled();
    const closeButton = host().querySelector<HTMLButtonElement>('[data-testid="suggestions-close"]')!;
    expect(ref.disableClose).toBe(true);
    expect(closeButton.disabled).toBe(true);
    expect(createButton().disabled).toBe(true);

    request.flush({ items: [{ id: 1 }] }, { status: 201, statusText: 'Created' });
    await settled();

    expect(ref.disableClose).toBe(false);
    expect(closed).toEqual([{ kind: 'created', count: 1 }]);
  });

  it('names the way to the editor by the draft it opens', async () => {
    await opened();

    const names = drafts().map((draft) => draft.querySelector('[data-testid="suggestion-edit"]')!.getAttribute('aria-label'));
    expect(names).toEqual(ITEMS.map((item) => t('suggestions.openNamed', { name: item.name })));
  });

  it('marks the draft the server refused, counting among the ticked ones, and stays open', async () => {
    await opened();
    await tick(0);
    await tick(2);

    createButton().click();
    (await next('/api/v1/suggestions/accept')).flush(
      { type: 'about:blank', title: 'DEFINITION_INVALID', status: 422, code: 'DEFINITION_INVALID', params: { index: 1 }, errors: [], correlationId: 'x' },
      { status: 422, statusText: 'Unprocessable' },
    );
    await settled();

    const marked = drafts().map((draft) => draft.querySelector('[data-testid="suggestion-error"]') !== null);
    expect(marked).toEqual([false, false, true]);
    expect(closed).toEqual([]);
    expect(createButton().disabled).toBe(false);
  });

  it('says so when the engine has nothing to suggest', async () => {
    await opened([]);

    expect(host().querySelector('[data-testid="suggestions-empty"]')!.textContent).toBe(t('suggestions.empty'));
    expect(createButton().disabled).toBe(true);
  });

  it('shows why suggestions could not be read, and asks again on request', async () => {
    fixture = TestBed.createComponent(SuggestionsDialogComponent);
    fixture.detectChanges();
    (await next('/api/v1/suggestions')).flush(
      { type: 'about:blank', title: 'ENGINE_UNAVAILABLE', status: 503, code: 'ENGINE_UNAVAILABLE', params: {}, correlationId: 'x' },
      { status: 503, statusText: 'Unavailable' },
    );
    await settled();
    expect(host().textContent).toContain(t('errors.ENGINE_UNAVAILABLE.title'));

    host().querySelector<HTMLButtonElement>('[data-testid="error-banner"] button')!.click();
    (await next('/api/v1/suggestions')).flush({ items: ITEMS });
    await settled();

    expect(drafts()).toHaveLength(3);
    expect(host().querySelector('[data-testid="error-banner"]')).toBeNull();
  });

  it('hands a draft to the editor and creates nothing', async () => {
    await opened();

    drafts()[1].querySelector<HTMLButtonElement>('[data-testid="suggestion-edit"]')!.click();

    expect(closed).toEqual([{ kind: 'edit', item: ITEMS[1] }]);
    http.expectNone('/api/v1/suggestions/accept');
  });
});
