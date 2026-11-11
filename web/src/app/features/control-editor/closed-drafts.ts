import { Injectable } from '@angular/core';

import { EditorSnapshot } from './editor.types';

/**
 * The draft that was last closed without a save, kept for as long as the page lives so the toast's undo
 * can bring it back. One draft: closing another one replaces it, and it is handed out once.
 */
@Injectable({ providedIn: 'root' })
export class ClosedDrafts {
  private kept: { readonly path: string; readonly snapshot: EditorSnapshot } | null = null;

  /** Keeps a draft under the address of its editor (`/controls/new`, `/controls/12`). */
  keep(path: string, snapshot: EditorSnapshot): void {
    this.kept = { path, snapshot };
  }

  /** Hands out the draft that was closed at this address, and forgets it; null when there is none. */
  take(path: string): EditorSnapshot | null {
    const kept = this.kept;
    if (kept?.path !== path) {
      return null;
    }
    this.kept = null;
    return kept.snapshot;
  }
}
