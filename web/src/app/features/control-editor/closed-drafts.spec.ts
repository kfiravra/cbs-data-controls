import { IdSource } from '../../core/definition/draft';
import { newDraft } from '../../core/definition/draft.edit';
import { ClosedDrafts } from './closed-drafts';
import { EditorSnapshot } from './editor.types';

function snapshot(name: string): EditorSnapshot {
  const ids = new IdSource();
  return { control: null, name, description: '', rootEntity: 'order', draft: newDraft(ids), ids, fromNothing: true, ideas: [] };
}

describe('ClosedDrafts', () => {
  it('hands out the draft that was closed at an address once, and then has none', () => {
    const drafts = new ClosedDrafts();
    const closed = snapshot('late orders');
    drafts.keep('/controls/new', closed);

    expect(drafts.take('/controls/new')).toBe(closed);
    expect(drafts.take('/controls/new')).toBeNull();
  });

  it('gives nothing to another address, and keeps the draft for its own', () => {
    const drafts = new ClosedDrafts();
    const closed = snapshot('late orders');
    drafts.keep('/controls/12', closed);

    expect(drafts.take('/controls/new')).toBeNull();
    expect(drafts.take('/controls/12')).toBe(closed);
  });

  it('keeps one draft: the one that was closed last', () => {
    const drafts = new ClosedDrafts();
    const second = snapshot('second');
    drafts.keep('/controls/new', snapshot('first'));
    drafts.keep('/controls/7', second);

    expect(drafts.take('/controls/new')).toBeNull();
    expect(drafts.take('/controls/7')).toBe(second);
  });
});
