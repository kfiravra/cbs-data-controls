import { SUGGEST, control, editorHarness, sentenceOf } from '../../../testing/editor-store';
import { DraftCondition, DraftGroup } from '../../core/definition/draft';

describe('EditorStore: a closed draft, and the simple and the advanced builder', () => {
  let h: ReturnType<typeof editorHarness>;
  let store: ReturnType<typeof editorHarness>['store'];
  const settle = () => h.settle();
  const next = (url: string) => h.next(url);
  const open = (...args: Parameters<typeof h.open>) => h.open(...args);
  const openComplete = () => h.openComplete();
  const answerValidate = (...args: Parameters<typeof h.answerValidate>) => h.answerValidate(...args);

  beforeEach(() => {
    h = editorHarness();
    ({ store } = h);
  });

  afterEach(() => h.finish());

  describe('a draft that was closed, and the way back to it', () => {
    /**
     * Another control takes the screen, and then the closed draft is asked back. The glossary was read
     * with the first control and is not read again.
     */
    async function closeAndRestore(closed: ReturnType<typeof store.snapshot>): Promise<void> {
      await store.open({ id: null });
      settle();
      await store.restore(closed);
      settle();
      // a draft that starts from nothing and came back with no suggestions asks for them again
      if (closed.fromNothing && closed.rootEntity !== null && closed.ideas.length === 0) {
        (await next(SUGGEST)).flush({ items: [] });
        await Promise.resolve();
        settle();
      }
    }

    it('brings a new control back as it was typed, still unsaved, and reads nothing but the glossary', async () => {
      const id = await openComplete();
      store.setName('late orders');
      const closed = store.snapshot();

      await closeAndRestore(closed);

      expect(store.loadState()).toBe('ready');
      expect(store.name()).toBe('late orders');
      expect(store.rootEntity()).toBe('order');
      expect(store.draft()).toBe(closed.draft);
      expect(store.control()).toBeNull();
      expect(store.fromNothing()).toBe(true);
      expect(store.dirty()).toBe(true);
      // the sentence of the draft is asked for again: the one it had went with the screen
      answerValidate(sentenceOf([id, 'total above 5']));
      expect(store.sentence().parts).toEqual(sentenceOf([id, 'total above 5']));
    });

    it('brings the draft of a stored control back with its control and its token', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');
      const closed = store.snapshot();

      await closeAndRestore(closed);

      expect(store.control()?.concurrencyToken).toBe('token-3');
      expect(store.name()).toBe('renamed');
      expect(store.fromNothing()).toBe(false);
      expect(store.dirty()).toBe(true);
      answerValidate([]);
    });

    it('gives a row added after the way back an id the draft does not hold', async () => {
      await openComplete();
      store.apply({ kind: 'addCondition', group: store.draft().key });
      const closed = store.snapshot();
      const held = closed.draft.children.map((child) => (child as DraftCondition).id);

      await closeAndRestore(closed);
      store.apply({ kind: 'addCondition', group: store.draft().key });

      const added = (store.draft().children.at(-1) as DraftCondition).id;
      expect(held).not.toContain(added);
      expect(store.draft().children).toHaveLength(held.length + 1);
    });

    it('brings the advanced builder back as it was left, and asks again for suggestions it came back without', async () => {
      await h.openNew();
      store.advanced.set(true);
      store.setName('wide');
      const closed = store.snapshot();
      expect(closed.ideas).toEqual([]);

      await store.open({ id: null });
      settle();
      await store.restore(closed);
      const asked = await next(SUGGEST);

      expect(asked.request.body).toEqual({ rootEntity: 'order', max: 3 });
      asked.flush({ items: [] });
      await Promise.resolve();
      settle();
      expect(store.view()?.advanced).toBe(true);
    });

    it('leaves the control on the screen alone when a save that was sent for another one lands', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed while it is open');
      const saving = store.save();
      const sent = await next('/api/v1/controls/7');

      // another control takes the screen before the save answers
      await store.open({ id: null });
      settle();
      sent.flush(control({ name: 'renamed while it is open', concurrencyToken: 'token-4' }));
      const outcome = await saving;

      expect(outcome.kind).toBe('saved');
      expect(store.control()).toBeNull();
      expect(store.name()).toBe('');
      expect(store.saveState()).toBe('idle');
    });

    it('lets a newer open stand when a way back answers after it', async () => {
      await openComplete();
      const closed = store.snapshot();

      const restoring = store.restore(closed);
      const opening = store.open({ id: 7 });
      (await next('/api/v1/controls/7')).flush(control());
      await Promise.all([restoring, opening]);
      settle();

      expect(store.control()?.id).toBe(7);
      expect(store.dirty()).toBe(false);
      answerValidate([]);
    });
  });

  describe('simple and advanced', () => {
    it('is simple until the advanced actions are asked for, and simple again when they are put away', async () => {
      await h.openNew();
      expect(store.view()?.advanced).toBe(false);

      store.advanced.set(true);
      expect(store.view()?.advanced).toBe(true);

      store.advanced.set(false);
      expect(store.view()?.advanced).toBe(false);
    });

    it('shows a draft that holds a group or related records in full, whatever was asked for', async () => {
      await h.openNew();
      store.advanced.set(true);
      store.apply({ kind: 'addGroup', group: store.draft().key });
      store.advanced.set(false);

      expect(store.view()?.advanced).toBe(true);

      store.apply({ kind: 'remove', target: (store.draft().children.at(-1) as DraftGroup).key });

      expect(store.view()?.advanced).toBe(false);
    });

    it('starts every control that is opened in the simple form', async () => {
      await h.openNew();
      store.advanced.set(true);

      const opening = store.open({ id: 7 });
      (await next('/api/v1/controls/7')).flush(control());
      await opening;
      settle();

      expect(store.view()?.advanced).toBe(false);
      answerValidate([]);
    });
  });
});
