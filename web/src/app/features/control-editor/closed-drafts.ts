import { Injectable, signal } from '@angular/core';

import { EditorSnapshot } from './editor.types';

/**
 * The draft that was last closed without a save, kept for as long as the page lives so the toast's undo
 * can bring it back. One draft: closing another one replaces it, and it is handed out once, to the editor
 * at its own address, after it was asked back.
 */
@Injectable({ providedIn: 'root' })
export class ClosedDrafts {
  private kept: { readonly path: string; readonly snapshot: EditorSnapshot } | null = null;
  private readonly askedFor = signal<string | null>(null);

  /**
   * The address whose draft was asked back and is not handed out yet. A signal, so an editor that already
   * stands at that address hears the question: no navigation would tell it.
   */
  readonly wanted = this.askedFor.asReadonly();

  /** Keeps a draft under the address of its editor (`/controls/new`, `/controls/12`). */
  keep(path: string, snapshot: EditorSnapshot): void {
    this.kept = { path, snapshot };
    this.askedFor.set(null);
  }

  /** Asks for the draft that was closed at an address; nothing is asked when no draft of that address is kept. */
  ask(path: string): void {
    if (this.kept?.path === path) {
      this.askedFor.set(path);
    }
  }

  /**
   * Hands out the draft of an address that was asked back, and forgets it; null when none was asked for
   * there. Taken before the caller keeps the draft it replaces: the one place would otherwise lose it.
   */
  take(path: string): EditorSnapshot | null {
    const kept = this.kept;
    if (kept?.path !== path || this.askedFor() !== path) {
      return null;
    }
    this.kept = null;
    this.askedFor.set(null);
    return kept.snapshot;
  }
}
