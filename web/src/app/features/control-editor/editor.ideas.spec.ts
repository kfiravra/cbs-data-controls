import { STORED, SUGGEST, control, editorHarness, sentenceOf } from '../../../testing/editor-store';
import { SuggestionItem } from '../../core/api/api.types';
import { DraftCondition, DraftGroup } from '../../core/definition/draft';
import { IDEAS_MAX } from './editor.ideas';

const numberOf = (id: string) => Number(id.slice(1));
const idsOf = (draft: DraftGroup) => draft.children.map((child) => (child as DraftCondition).id);

describe('EditorStore: suggestions for the choice', () => {
  let h: ReturnType<typeof editorHarness>;
  let http: ReturnType<typeof editorHarness>['http'];
  let store: ReturnType<typeof editorHarness>['store'];
  const next = (url: string) => h.next(url);
  const open = (...args: Parameters<typeof h.open>) => h.open(...args);
  const answerValidate = (...args: Parameters<typeof h.answerValidate>) => h.answerValidate(...args);

  beforeEach(() => {
    h = editorHarness();
    ({ http, store } = h);
  });

  afterEach(() => h.finish());

  const idea = (name: string): SuggestionItem => ({
    name,
    description: `finds ${name}`,
    rationale: 'why',
    evidence: [{ key: 'now', params: {}, text: '3 of 85' }],
    definition: STORED,
    sentence: '',
    sentenceParts: sentenceOf(['c1', 'total above 100'], ['c2', 'reference is x']),
  });

  it('are asked for the chosen entity, three at most, and held while the control is new', async () => {
    await open({ id: null });

    store.chooseRoot('order');
    expect(store.ideas.loading()).toBe(true);
    const request = await next(SUGGEST);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ rootEntity: 'order', max: IDEAS_MAX });
    request.flush({ items: ['a', 'b', 'c', 'd'].map(idea) });
    await Promise.resolve();
    await Promise.resolve();

    expect(store.ideas.loading()).toBe(false);
    expect(store.ideas.items().map((item) => item.name)).toEqual(['a', 'b', 'c']);
  });

  it('are none, with no word of it, when the engine does not answer', async () => {
    await open({ id: null });

    store.chooseRoot('order');
    (await next(SUGGEST)).error(new ProgressEvent('error'));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.ideas.items()).toEqual([]);
    expect(store.ideas.loading()).toBe(false);
    expect(store.failure()).toBeNull();
  });

  it('follow the last choice when an answer for an earlier one comes late', async () => {
    await open({ id: null });
    store.chooseRoot('order');
    const earlier = await next(SUGGEST);
    store.chooseRoot('customer');
    const later = await next(SUGGEST);

    later.flush({ items: [idea('about customers')] });
    earlier.flush({ items: [idea('about orders')] });
    await Promise.resolve();
    await Promise.resolve();

    expect(store.ideas.items().map((item) => item.name)).toEqual(['about customers']);
  });

  const others: [string, () => Promise<void>][] = [
    ['a stored control', () => open({ id: 7 }, control())],
    ['a copy of a control', () => open({ id: null, from: 7 }, control())],
    ['a draft that came from the suggestions panel', () => open({ id: null, draft: { name: 'suggested', description: 'why', definition: STORED } })],
  ];
  for (const [name, start] of others) {
    it(`are not asked for ${name}: it did not start from nothing`, async () => {
      await start();
      answerValidate([]);

      store.chooseRoot('customer');

      http.expectNone(SUGGEST);
      expect(store.ideas.items()).toEqual([]);
      expect(store.ideas.loading()).toBe(false);
    });
  }

  it('fill the conditions from the one that is chosen, and the name and the description where nothing was typed', async () => {
    await open({ id: null });
    await h.choose('order', [idea('late orders')]);
    const before = store.draft();

    const undo = store.applyIdea(store.ideas.items()[0]);

    expect(store.draft().children.map((child) => (child as DraftCondition).id)).toEqual(['c1', 'c2']);
    expect([store.name(), store.description()]).toEqual(['late orders', 'finds late orders']);
    expect(store.dirty()).toBe(true);
    answerValidate([]);

    // a row added after the suggestion gets an id above every id of the session: the suggestion's two, and
    // the ones the empty draft before it was given
    store.apply({ kind: 'addCondition', group: store.draft().key });
    const added = (store.draft().children[2] as DraftCondition).id;
    expect(numberOf(added)).toBeGreaterThan(Math.max(2, ...idsOf(before).map(numberOf)));

    // the way back is from the suggestion's conditions as they were: these were built on, and stay
    undo();
    expect(store.draft()).not.toBe(before);
  });

  it('leave a name that was typed as it is, and give back what was there when the way back is taken', async () => {
    await open({ id: null });
    await h.choose('order', [idea('late orders')]);
    store.setName('my own name');
    const before = store.draft();

    const undo = store.applyIdea(store.ideas.items()[0]);
    expect([store.name(), store.description()]).toEqual(['my own name', 'finds late orders']);

    undo();
    expect(store.draft()).toBe(before);
    expect([store.name(), store.description()]).toEqual(['my own name', '']);
    // an id is given once in a session: the next row repeats neither a row that came back nor one of the
    // suggestion's, which may yet come back with another press
    store.apply({ kind: 'addCondition', group: store.draft().key });
    const added = (store.draft().children.at(-1) as DraftCondition).id;
    expect(numberOf(added)).toBeGreaterThan(Math.max(2, ...idsOf(before).map(numberOf)));
  });

  it('are no longer asked for once the control was saved: it is a stored control now', async () => {
    await open({ id: null });
    await h.choose('order', [idea('late orders')]);
    store.applyIdea(store.ideas.items()[0]);
    answerValidate([]);

    const saving = store.save();
    (await next('/api/v1/controls')).flush({ ...control(), id: 31 });
    await saving;
    expect(store.ideas.items()).toEqual([]);

    store.chooseRoot('customer');

    http.expectNone(SUGGEST);
    expect(store.ideas.loading()).toBe(false);
  });
});
