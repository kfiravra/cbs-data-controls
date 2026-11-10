import { Injectable, computed, inject, signal } from '@angular/core';

import { DraftGroup, IdSource } from '../../core/definition/draft';
import { DraftCheck, DraftIssue, checkDraft } from '../../core/definition/draft.check';
import { DraftEdit, FocusTarget, applyEdit, newDraft } from '../../core/definition/draft.edit';
import { MarksService } from '../../core/definition/marks.service';
import { mapFor, rootEntities } from '../../core/glossary/glossary.lookups';
import { GlossaryService } from '../../core/glossary/glossary.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BuilderView, RowMessage } from '../../shared/condition-builder/builder-view';

const NO_MESSAGES: ReadonlyMap<string, readonly RowMessage[]> = new Map();

/** What a row says for an issue of the client's own check: the translation key and what it needs. */
function messageOf(issue: DraftIssue, check: DraftCheck): RowMessage {
  return {
    key: `editor.issues.${issue.kind}`,
    params: { max: check.limits.maxListValues },
    input: issue.input,
    index: issue.index,
  };
}

/**
 * The state of the control editor, provided by its page: the root entity, the draft tree, what the client's
 * check says about it, and the condition under the pointer or in focus. Every edit of the builder goes
 * through `apply`.
 */
@Injectable()
export class EditorStore {
  private readonly glossaryService = inject(GlossaryService);
  private readonly language = inject(LanguageService);
  private readonly marksService = inject(MarksService);
  private ids = new IdSource();

  readonly glossary = this.glossaryService.glossary;
  readonly glossaryError = this.glossaryService.error;
  readonly rootEntity = signal<string | null>(null);
  readonly draft = signal<DraftGroup>(newDraft(this.ids));
  readonly traced = signal<string | null>(null);
  /** Where the keyboard focus goes after the last edit. */
  readonly focus = signal<FocusTarget | null>(null);
  /** Set once the user asked to save an unfinished draft: errors show on save, not while typing. */
  readonly showErrors = signal(false);

  readonly check = computed<DraftCheck | null>(() => {
    const glossary = this.glossary();
    const rootEntity = this.rootEntity();
    return glossary && rootEntity ? checkDraft(this.draft(), rootEntity, glossary, this.language.lang) : null;
  });

  readonly marks = computed(() => this.marksService.of(this.draft()));

  readonly messages = computed<ReadonlyMap<string, readonly RowMessage[]>>(() => {
    const check = this.check();
    if (!check || !this.showErrors()) {
      return NO_MESSAGES;
    }
    return new Map([...check.issues].map(([id, issues]) => [id, issues.map((issue) => messageOf(issue, check))]));
  });

  readonly view = computed<BuilderView | null>(() => {
    const glossary = this.glossary();
    const check = this.check();
    return glossary && check
      ? { glossary, check, marks: this.marks(), messages: this.messages(), traced: this.traced() }
      : null;
  });

  readonly map = computed(() => {
    const glossary = this.glossary();
    const rootEntity = this.rootEntity();
    return glossary && rootEntity ? mapFor(glossary, rootEntity) : null;
  });

  /** A new control: the first entity the glossary allows as a root, and one empty condition. */
  async startNew(): Promise<void> {
    const glossary = await this.glossaryService.load();
    const first = glossary ? rootEntities(glossary)[0] : undefined;
    if (first && this.rootEntity() === null) {
      this.rootEntity.set(first.key);
    }
  }

  /** The conditions of one entity mean nothing for another: a new root entity starts the tree over. */
  chooseRoot(key: string): void {
    if (key === this.rootEntity()) {
      return;
    }
    this.rootEntity.set(key);
    this.draft.set(newDraft(this.ids));
    this.focus.set(null);
  }

  apply(edit: DraftEdit): void {
    const glossary = this.glossary();
    const rootEntity = this.rootEntity();
    if (!glossary || !rootEntity) {
      return;
    }
    const result = applyEdit(this.draft(), edit, { glossary, rootEntity, ids: this.ids });
    this.draft.set(result.draft);
    if (result.focus) {
      this.focus.set(result.focus);
    }
  }
}
