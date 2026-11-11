import { IdSource } from '../../core/definition/draft';
import { newDraft } from '../../core/definition/draft.edit';
import { ClosedDrafts } from './closed-drafts';
import { EditorSnapshot } from './editor.types';

function snapshot(name: string): EditorSnapshot {
  const ids = new IdSource();
  return { control: null, name, description: '', rootEntity: 'order', draft: newDraft(ids), ids, fromNothing: true, advanced: false, ideas: [] };
}

describe('ClosedDrafts', () => {
  it('hands out a draft once it was asked back at its address, and then has none', () => {
    const drafts = new ClosedDrafts();
    const closed = snapshot('late orders');
    drafts.keep('/controls/new', closed);

    // an editor that opens at the address without the draft being asked for gets nothing: a new control is new
    expect(drafts.take('/controls/new')).toBeNull();

    drafts.ask('/controls/new');
    expect(drafts.wanted()).toBe('/controls/new');
    expect(drafts.take('/controls/new')).toBe(closed);
    expect(drafts.wanted()).toBeNull();
    expect(drafts.take('/controls/new')).toBeNull();
  });

  it('gives nothing to another address, and keeps the draft for its own', () => {
    const drafts = new ClosedDrafts();
    const closed = snapshot('late orders');
    drafts.keep('/controls/12', closed);
    drafts.ask('/controls/new');

    expect(drafts.wanted()).toBeNull();
    expect(drafts.take('/controls/new')).toBeNull();

    drafts.ask('/controls/12');
    expect(drafts.take('/controls/12')).toBe(closed);
  });

  it('keeps one draft, the one that was closed last, and forgets a question about the one before', () => {
    const drafts = new ClosedDrafts();
    const second = snapshot('second');
    drafts.keep('/controls/new', snapshot('first'));
    drafts.ask('/controls/new');
    drafts.keep('/controls/7', second);

    expect(drafts.wanted()).toBeNull();
    expect(drafts.take('/controls/new')).toBeNull();
    drafts.ask('/controls/7');
    expect(drafts.take('/controls/7')).toBe(second);
  });

  it('lets a draft that was asked back be taken before the draft it replaces is kept: both survive', () => {
    const drafts = new ClosedDrafts();
    const asked = snapshot('asked back');
    const replaced = snapshot('on the screen');
    drafts.keep('/controls/new', asked);
    drafts.ask('/controls/new');

    // the order the editor follows: take what was asked for, then keep what it takes the place of
    const taken = drafts.take('/controls/new');
    drafts.keep('/controls/new', replaced);

    expect(taken).toBe(asked);
    drafts.ask('/controls/new');
    expect(drafts.take('/controls/new')).toBe(replaced);
  });
});
