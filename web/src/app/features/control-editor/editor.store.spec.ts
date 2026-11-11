import {
  STORED,
  VALIDATE,
  control,
  editorHarness,
  letters,
  problem,
  sentenceOf,
} from '../../../testing/editor-store';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { DraftCondition, DraftGroup } from '../../core/definition/draft';
import { VALIDATE_DEBOUNCE_MS } from './editor.store';

describe('EditorStore', () => {
  let h: ReturnType<typeof editorHarness>;
  let http: ReturnType<typeof editorHarness>['http'];
  let store: ReturnType<typeof editorHarness>['store'];
  const settle = () => h.settle();
  const wait = (milliseconds: number) => h.wait(milliseconds);
  const firstRow = () => h.firstRow();
  const next = (url: string) => h.next(url);
  const open = (...args: Parameters<typeof h.open>) => h.open(...args);
  const openComplete = () => h.openComplete();
  const answerValidate = (...args: Parameters<typeof h.answerValidate>) => h.answerValidate(...args);

  beforeEach(() => {
    h = editorHarness();
    ({ http, store } = h);
  });

  afterEach(() => h.finish());

  describe('opening', () => {
    it('starts a new control on the first root entity, with nothing to lose yet', async () => {
      await open({ id: null });

      expect(store.loadState()).toBe('ready');
      expect(store.rootEntity()).toBe(SYNTHETIC_GLOSSARY.entities.find((entity) => entity.rootable)!.key);
      expect(store.dirty()).toBe(false);
    });

    it('loads a stored control with its details and its conditions under their own ids', async () => {
      await open({ id: 7 }, control());

      expect(store.name()).toBe('stored control');
      expect(store.rootEntity()).toBe('order');
      expect(store.draft().children.map((child) => (child as DraftCondition).id)).toEqual(['c1', 'c2']);
      expect(store.dirty()).toBe(false);
      answerValidate(sentenceOf(['c1', 'a'], ['c2', 'b']));
    });

    it('gives a new row of a stored control an id above the ids it came with', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      store.apply({ kind: 'addCondition', group: store.draft().key });

      const added = store.draft().children[2] as DraftCondition;
      expect(['c1', 'c2']).not.toContain(added.id);
      expect(Number(added.id.slice(1))).toBeGreaterThan(2);
    });

    it('starts a copy from another control: its conditions, a new name, and no control behind it', async () => {
      await open({ id: null, from: 7, copyName: (name) => `${name} (copy)` }, control());

      expect(store.control()).toBeNull();
      expect(store.name()).toBe('stored control (copy)');
      expect(store.draft().children).toHaveLength(2);
      expect(store.dirty()).toBe(true);
      answerValidate([]);
    });

    it('starts from a suggested control', async () => {
      await open({ id: null, draft: { name: 'suggested', description: 'why', definition: STORED } });

      expect([store.name(), store.description(), store.control()]).toEqual(['suggested', 'why', null]);
      answerValidate([]);
    });

    it('says so at once, on the rows, when a stored control no longer validates', async () => {
      await open({ id: 7 }, control());
      wait(VALIDATE_DEBOUNCE_MS);

      http
        .expectOne(VALIDATE)
        .flush(problem(422, 'DEFINITION_INVALID', [{ code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} }]), {
          status: 422,
          statusText: 'Unprocessable',
        });

      expect(store.outdated()).toBe(true);
      expect(store.messages().get('c2')).toEqual([
        { key: 'errors.definition.UNKNOWN_FIELD', params: {}, input: 'left', index: undefined },
      ]);
    });

    it('still says a stored control is outdated when the engine answers only on a second try', async () => {
      await open({ id: 7 }, control());
      wait(VALIDATE_DEBOUNCE_MS);
      http.expectOne(VALIDATE).flush(problem(503, 'ENGINE_UNAVAILABLE'), { status: 503, statusText: 'Unavailable' });
      expect(store.outdated()).toBe(false);

      store.revalidate();
      settle();
      wait(VALIDATE_DEBOUNCE_MS);
      http
        .expectOne(VALIDATE)
        .flush(problem(422, 'DEFINITION_INVALID', [{ code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} }]), {
          status: 422,
          statusText: 'Unprocessable',
        });

      expect(store.outdated()).toBe(true);
      expect([...store.messages().keys()]).toEqual(['c2']);
    });

    it('takes a 422 as an error of the edit once the stored control was edited before its first sentence', async () => {
      await open({ id: 7 }, control());
      store.apply({ kind: 'value', id: 'c1', value: '250' });
      settle();
      wait(VALIDATE_DEBOUNCE_MS);

      http
        .expectOne(VALIDATE)
        .flush(problem(422, 'DEFINITION_INVALID', [{ code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: 'c1', params: {} }]), {
          status: 422,
          statusText: 'Unprocessable',
        });

      expect(store.outdated()).toBe(false);
      expect(store.messages().size).toBe(0);
    });

    it('reads the glossary and the control again when asked to, also for the control it already holds', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const again = store.open({ id: 7 }, true);
      (await next('/api/v1/controls/7')).flush(control({ name: 'read again' }));
      await again;

      expect(store.name()).toBe('read again');
      settle();
      answerValidate([]);
    });

    it('leaves the screen to the newer of two opens when the older one answers last', async () => {
      const older = store.open({ id: 7 });
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      const first = await next('/api/v1/controls/7');
      const newer = store.open({ id: 8 });
      (await next('/api/v1/controls/8')).flush(control({ id: 8, name: 'the newer one' }));
      await newer;

      first.flush(control({ name: 'the older one' }));
      await older;

      expect([store.control()?.id, store.name()]).toEqual([8, 'the newer one']);
      settle();
      answerValidate([]);
    });

    it('is not found when no control has the id', async () => {
      const opening = store.open({ id: 9 });
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next('/api/v1/controls/9')).flush(problem(404, 'CONTROL_NOT_FOUND'), { status: 404, statusText: 'Not Found' });
      await opening;

      expect(store.loadState()).toBe('notFound');
      expect(store.failure()).toBeNull();
    });
  });

  describe('saving', () => {
    it('sends nothing and shows what is missing when a detail or a row is unfinished', async () => {
      await open({ id: null });

      const outcome = await store.save();

      expect(outcome).toEqual({ kind: 'invalid' });
      expect(store.nameIssue()).toBe('required');
      expect(store.messages().get(firstRow().id)).toEqual([
        { key: 'editor.issues.missingField', params: { max: SYNTHETIC_GLOSSARY.limits.maxListValues }, input: 'left', index: undefined },
      ]);
      http.expectNone('/api/v1/controls');
    });

    it('points the focus at the first unfinished input when the details are in order', async () => {
      const id = await openComplete();
      wait(VALIDATE_DEBOUNCE_MS);
      http.expectOne(VALIDATE).flush({ valid: true, sentence: '', sentenceParts: [], conditions: [] });
      store.setName('a name');
      store.apply({ kind: 'value', id, value: 'not a number' });

      await store.save();

      expect(store.focus()).toEqual({ node: id, input: 'value' });
    });

    it('creates a new control and takes what the server stored', async () => {
      const id = await openComplete();
      answerValidate([]);
      store.setName('  a name  ');

      const saving = store.save();
      const request = await next('/api/v1/controls');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toMatchObject({ name: 'a name', description: null });
      expect(request.request.body.definition.where.children[0].id).toBe(id);
      expect(store.saveState()).toBe('saving');
      request.flush(control({ id: 12, version: 1, name: 'a name' }));

      expect(await saving).toMatchObject({ kind: 'saved', created: true, newVersion: false });
      expect(store.control()?.id).toBe(12);
      expect(store.dirty()).toBe(false);
      expect(store.saveState()).toBe('idle');
    });

    it('updates a stored control with its token, and says when the save made a new version', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.apply({ kind: 'value', id: 'c1', value: '200' });

      const saving = store.save();
      const request = await next('/api/v1/controls/7');
      expect(request.request.method).toBe('PUT');
      expect(request.request.body.concurrencyToken).toBe('token-3');
      request.flush(control({ version: 4, concurrencyToken: 'token-4' }));

      expect(await saving).toMatchObject({ kind: 'saved', created: false, newVersion: true });
      expect(store.control()?.concurrencyToken).toBe('token-4');
      settle();
      answerValidate([]);
    });

    it('keeps the version when only the name changed', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(control({ name: 'renamed', concurrencyToken: 'token-3b' }));

      expect(await saving).toMatchObject({ kind: 'saved', newVersion: false });
    });

    it('puts each error of a refused save on its row and its input, and keeps the rest for the screen', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(
        problem(422, 'DEFINITION_INVALID', [
          { code: 'TOO_DEEP', path: '/where', params: { max: 4, actual: 5 } },
          { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: 'c1', params: {} },
          // no node id: the row is found by the path, in the definition that was sent
          { code: 'UNKNOWN_FIELD', path: '/where/children/1/left', params: {} },
        ]),
        { status: 422, statusText: 'Unprocessable' },
      );

      expect(await saving).toEqual({ kind: 'failed' });
      expect(store.messages().get('c1')).toEqual([
        { key: 'errors.definition.VALUE_TYPE_MISMATCH', params: {}, input: 'value', index: undefined },
      ]);
      expect(store.messages().get('c2')).toEqual([
        { key: 'errors.definition.UNKNOWN_FIELD', params: {}, input: 'left', index: undefined },
      ]);
      expect(store.treeErrors().map((error) => error.code)).toEqual(['TOO_DEEP']);
      expect(store.focus()).toEqual({ node: 'c1', input: 'value' });
      expect([...store.openNodes()].sort()).toEqual(['c1', 'c2']);
    });

    it('drops what the server said about a row when that row is edited, and keeps it for the others', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(
        problem(422, 'DEFINITION_INVALID', [
          { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: 'c1', params: {} },
          { code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} },
        ]),
        { status: 422, statusText: 'Unprocessable' },
      );
      await saving;

      store.apply({ kind: 'value', id: 'c1', value: '300' });

      expect([...store.messages().keys()]).toEqual(['c2']);
      settle();
      answerValidate([]);
    });

    it('forgets what the server said about a row when that row is removed', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(
        problem(422, 'DEFINITION_INVALID', [{ code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} }]),
        { status: 422, statusText: 'Unprocessable' },
      );
      await saving;
      expect(store.status()).toMatchObject({ kind: 'invalid', mark: letters[1] });

      store.apply({ kind: 'remove', target: 'c2' });

      expect(store.messages().size).toBe(0);
      expect(store.status()).toBeNull();
      settle();
      answerValidate([]);
    });

    it('keeps what was typed while a save was on its way, and keeps it guarded', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('first name');

      const saving = store.save();
      const request = await next('/api/v1/controls/7');
      store.setName('typed during the save');
      request.flush(control({ name: 'first name', concurrencyToken: 'token-3b' }));
      await saving;

      expect(store.name()).toBe('typed during the save');
      expect(store.dirty()).toBe(true);
      expect(store.control()?.concurrencyToken).toBe('token-3b');
    });

    it('sends one request when save is asked twice in a row', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const first = store.save();
      const second = store.save();
      (await next('/api/v1/controls/7')).flush(control());

      expect(await second).toEqual({ kind: 'failed' });
      expect(await first).toMatchObject({ kind: 'saved' });
    });

    it('says that the control was saved elsewhere, and reads it again when asked', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('mine');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(problem(409, 'CONCURRENCY_CONFLICT'), { status: 409, statusText: 'Conflict' });
      await saving;
      expect(store.conflict()).toBe(true);
      expect(store.failure()).toBeNull();

      const reloading = store.reload();
      (await next('/api/v1/controls/7')).flush(control({ name: 'theirs', version: 4, concurrencyToken: 'token-4' }));
      await reloading;

      expect(store.conflict()).toBe(false);
      expect([store.name(), store.control()?.concurrencyToken]).toEqual(['theirs', 'token-4']);
      settle();
      answerValidate([]);
    });

    it('becomes read-only when the server says the control is archived', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(problem(409, 'CONTROL_ARCHIVED'), { status: 409, statusText: 'Conflict' });
      await saving;

      expect(store.archived()).toBe(true);
    });

    it('runs the control after the save when asked to save and run', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const saving = store.save(true);
      (await next('/api/v1/controls/7')).flush(control());
      const started = await next('/api/v1/controls/7/runs');
      expect(store.saveState()).toBe('running');
      expect(started.request.method).toBe('POST');
      started.flush({ id: 41, controlId: 7, status: 'succeeded' });

      expect(await saving).toMatchObject({ kind: 'ran', run: { id: 41 } });
    });

    it('keeps the save and shows the failure when the run after it does not start', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const saving = store.save(true);
      (await next('/api/v1/controls/7')).flush(control({ concurrencyToken: 'token-3b' }));
      (await next('/api/v1/controls/7/runs')).flush(problem(503, 'DATABASE_UNAVAILABLE'), { status: 503, statusText: 'Unavailable' });

      expect(await saving).toEqual({ kind: 'failed' });
      expect(store.failure()?.code).toBe('DATABASE_UNAVAILABLE');
      expect(store.control()?.concurrencyToken).toBe('token-3b');
      expect(store.dirty()).toBe(false);
    });
  });

  describe('the root entity and the archive', () => {
    it('starts the conditions over for another root entity, and gives a way back', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      const before = store.draft();

      const undo = store.chooseRoot('customer');

      expect(store.rootEntity()).toBe('customer');
      expect(store.draft().children).toHaveLength(1);
      expect((store.draft().children[0] as DraftCondition).left).toBeUndefined();
      expect(store.dirty()).toBe(true);

      undo!();
      expect([store.rootEntity(), store.draft()]).toEqual(['order', before]);
      expect(store.chooseRoot('order')).toBeNull();
    });

    it('gives a way back from a removal: the condition returns under its id and its mark', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      const before = store.draft();

      const removal = store.apply({ kind: 'remove', target: 'c2' });

      expect(removal!.mark).toBe(letters[1]);
      expect(store.draft().children).toHaveLength(1);

      removal!.undo();
      expect(store.draft()).toBe(before);
      expect(store.marks().get('c2')).toBe(letters[1]);
      expect(store.dirty()).toBe(true);
    });

    it('names no mark for a removed group, and offers no way back from an edit that removes nothing', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.apply({ kind: 'addGroup', group: store.draft().key });
      const group = store.draft().children.at(-1) as DraftGroup;
      const before = store.draft();

      expect(store.apply({ kind: 'op', group: group.key, op: 'or' })).toBeNull();
      const removal = store.apply({ kind: 'remove', target: group.key });

      expect(removal!.mark).toBeUndefined();
      expect(store.draft().children).toHaveLength(before.children.length - 1);
    });

    it('archives the stored control', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const archiving = store.archive();
      const request = await next('/api/v1/controls/7');
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(await archiving).toBe(true);
    });
  });
});
