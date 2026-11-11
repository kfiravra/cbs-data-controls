import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, switchMap, timer } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import { Control } from '../../core/api/api.types';
import { ControlsApi } from '../../core/api/controls.api';
import { RunsApi } from '../../core/api/runs.api';
import { Definition } from '../../core/definition/definition.types';
import { DraftGroup, IdSource, fromDefinition, highestId, toDefinition } from '../../core/definition/draft';
import { DraftCheck, checkDraft } from '../../core/definition/draft.check';
import { DraftEdit, FocusTarget, applyEdit, newDraft } from '../../core/definition/draft.edit';
import { orderedNodeIds } from '../../core/definition/marks';
import { MarksService } from '../../core/definition/marks.service';
import { mapFor, rootEntities } from '../../core/glossary/glossary.lookups';
import { GlossaryService } from '../../core/glossary/glossary.service';
import { LanguageService } from '../../core/i18n/language.service';
import { changedNodes } from '../../core/text/text-parts';
import { BuilderView, RowMessage } from '../../shared/condition-builder/builder-view';
import { LocatedError, errorMessage, issueMessage, locateErrors, statusOf } from './editor.messages';
import {
  DetailIssue,
  EditorTarget,
  LoadState,
  Question,
  SaveOutcome,
  SaveState,
  Sent,
  Sentence,
  StatusLine,
  Validation,
} from './editor.types';

/** The sentence asks the engine this long after the last edit. */
export const VALIDATE_DEBOUNCE_MS = 400;
/** How long the marks of a rewritten clause stay flagged for the settle (its duration, and a little). */
const SETTLE_MS = 700;
const NAME_MAX = 200;
const DESCRIPTION_MAX = 1000;

const NO_MESSAGES: ReadonlyMap<string, readonly RowMessage[]> = new Map();

/** What a removal took away, and the way back. */
export interface Removal {
  /** The mark of the condition that was removed; undefined for a group, which goes with its conditions. */
  readonly mark?: string;
  readonly undo: () => void;
}

/**
 * The state of the control editor, provided by its page: the loaded control and its token, the details, the
 * root entity and the draft tree, what the client's check and the server say about them, the engine's
 * sentence, and the save. The store talks to the api; the page navigates and shows toasts and dialogs.
 */
@Injectable()
export class EditorStore {
  private readonly glossaryService = inject(GlossaryService);
  private readonly controlsApi = inject(ControlsApi);
  private readonly runsApi = inject(RunsApi);
  private readonly language = inject(LanguageService);
  private readonly marksService = inject(MarksService);
  private readonly destroyRef = inject(DestroyRef);
  private ids = new IdSource();
  /**
   * True from the load of a stored control until the engine has spoken about it or the user has edited it:
   * a 422 then means the stored definition is outdated. An engine that does not answer leaves it set.
   */
  private awaitingFirstSentence = false;
  /** Counts the calls of `open`: an older one that lands after a newer one changes nothing. */
  private turn = 0;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  readonly glossary = this.glossaryService.glossary;
  readonly glossaryError = this.glossaryService.error;

  readonly loadState = signal<LoadState>('loading');
  readonly control = signal<Control | null>(null);
  readonly name = signal('');
  readonly description = signal('');
  readonly rootEntity = signal<string | null>(null);
  readonly draft = signal<DraftGroup>(newDraft(this.ids));
  readonly dirty = signal(false);

  readonly traced = signal<string | null>(null);
  /** Where the keyboard focus goes after the last edit. */
  readonly focus = signal<FocusTarget | null>(null);
  /** Set once the user asked to save an unfinished draft: errors show on save, not while typing. */
  readonly showErrors = signal(false);
  readonly nameIssue = signal<DetailIssue | null>(null);
  readonly descriptionIssue = signal<DetailIssue | null>(null);

  readonly saveState = signal<SaveState>('idle');
  /** A failed load, save, run or archive. */
  readonly failure = signal<ApiError | null>(null);
  /** An engine that does not answer the sentence; gone as soon as a sentence comes back. */
  readonly sentenceFailure = signal<ApiError | null>(null);
  readonly conflict = signal(false);
  /** The stored definition no longer validates: a glossary key it uses has gone or changed. */
  readonly outdated = signal(false);

  readonly sentence = signal<Sentence>({ parts: null, stale: false });
  /** The nodes whose clause the last answer rewrote: their marks play the settle once. */
  readonly settling = signal<ReadonlySet<string>>(new Set());

  private readonly serverErrors = signal<readonly LocatedError[]>([]);
  private readonly liveErrors = signal<readonly LocatedError[]>([]);
  private readonly validateAgain = signal(0);

  readonly archived = computed(() => this.control()?.isActive === false);

  readonly check = computed<DraftCheck | null>(() => {
    const glossary = this.glossary();
    const rootEntity = this.rootEntity();
    return glossary && rootEntity ? checkDraft(this.draft(), rootEntity, glossary, this.language.lang) : null;
  });

  readonly marks = computed(() => this.marksService.of(this.draft()));

  /** The definition the draft stands for; null while anything is missing. */
  readonly definition = computed<Definition | null>(() => {
    const glossary = this.glossary();
    const rootEntity = this.rootEntity();
    return glossary && rootEntity && this.check()?.complete
      ? toDefinition(this.draft(), rootEntity, glossary, this.language.lang)
      : null;
  });

  /** What stands under each row: the server's errors, and the client's issues once the user asked to save. */
  readonly messages = computed<ReadonlyMap<string, readonly RowMessage[]>>(() => {
    const check = this.check();
    const located = this.serverErrors().filter((entry) => entry.location.nodeId !== undefined);
    if (!check || (located.length === 0 && !this.showErrors())) {
      return NO_MESSAGES;
    }
    const messages = new Map<string, RowMessage[]>();
    const add = (id: string, message: RowMessage) => messages.set(id, [...(messages.get(id) ?? []), message]);
    located.forEach((entry) => add(entry.location.nodeId!, errorMessage(entry)));
    if (this.showErrors()) {
      check.issues.forEach((issues, id) => issues.forEach((issue) => add(id, issueMessage(issue, check))));
    }
    return messages;
  });

  /** Server errors that name no row: of the whole tree, or of the root entity. */
  readonly treeErrors = computed(() =>
    this.serverErrors()
      .filter((entry) => entry.location.nodeId === undefined)
      .map((entry) => entry.error),
  );

  /** The nodes whose mark is open: unfinished, or refused by the server. */
  readonly openNodes = computed<ReadonlySet<string>>(
    () =>
      new Set([
        ...(this.check()?.issues.keys() ?? []),
        ...this.messages().keys(),
        ...this.liveErrors().flatMap((entry) => entry.location.nodeId ?? []),
      ]),
  );

  readonly status = computed<StatusLine | null>(() => {
    const check = this.check();
    return check
      ? statusOf(this.draft(), check, this.marks(), [...this.liveErrors(), ...this.serverErrors()])
      : null;
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

  constructor() {
    this.watchSentence();
    this.destroyRef.onDestroy(() => clearTimeout(this.settleTimer));
  }

  // ---------------------------------------------------------------- opening

  /**
   * Opens what the address names. A control the screen already holds (it was just saved under this id) is
   * left as it is, unless `again` asks to read everything once more: the glossary too.
   */
  async open(target: EditorTarget, again = false): Promise<void> {
    if (!again && target.id !== null && this.control()?.id === target.id) {
      return;
    }
    const turn = ++this.turn;
    this.reset();
    const glossary = await this.glossaryService.load();
    try {
      const stored = target.id ?? target.from ?? null;
      const control = stored !== null ? await firstValueFrom(this.controlsApi.get(stored)) : null;
      if (turn !== this.turn) {
        return;
      }
      if (control && target.id !== null) {
        this.adopt(control);
        this.awaitingFirstSentence = true;
      } else if (control) {
        this.startFrom(target.copyName?.(control.name) ?? control.name, control.description ?? '', control.definition);
      } else if (target.draft) {
        this.startFrom(target.draft.name, target.draft.description, target.draft.definition);
      } else {
        this.rootEntity.set((glossary ? rootEntities(glossary)[0] : undefined)?.key ?? null);
      }
      this.loadState.set('ready');
    } catch (error) {
      if (turn !== this.turn) {
        return;
      }
      const failure = toApiError(error);
      this.loadState.set(failure.status === 404 ? 'notFound' : 'failed');
      this.failure.set(failure.status === 404 ? null : failure);
    }
  }

  /** Reads the stored control again and replaces what the screen holds: the way out of a conflict. */
  async reload(): Promise<void> {
    const id = this.control()?.id;
    if (id !== undefined) {
      await this.open({ id }, true);
    }
  }

  private reset(): void {
    this.ids = new IdSource();
    this.awaitingFirstSentence = false;
    this.loadState.set('loading');
    this.control.set(null);
    this.name.set('');
    this.description.set('');
    this.rootEntity.set(null);
    this.draft.set(newDraft(this.ids));
    this.dirty.set(false);
    this.focus.set(null);
    this.showErrors.set(false);
    this.nameIssue.set(null);
    this.descriptionIssue.set(null);
    this.failure.set(null);
    this.sentenceFailure.set(null);
    this.conflict.set(false);
    this.outdated.set(false);
    this.serverErrors.set([]);
    this.liveErrors.set([]);
    this.sentence.set({ parts: null, stale: false });
    // the sentence was dropped: the same definition must be asked about again
    this.validateAgain.update((count) => count + 1);
  }

  private adopt(control: Control): void {
    this.control.set(control);
    this.name.set(control.name);
    this.description.set(control.description ?? '');
    this.load(control.definition);
    this.dirty.set(false);
  }

  private startFrom(name: string, description: string, definition: Definition): void {
    this.name.set(name);
    this.description.set(description);
    this.load(definition);
    this.dirty.set(true);
  }

  private load(definition: Definition): void {
    this.ids = new IdSource(highestId(definition.where));
    this.rootEntity.set(definition.rootEntity);
    this.draft.set(fromDefinition(definition, this.ids));
  }

  // ---------------------------------------------------------------- editing

  setName(name: string): void {
    this.name.set(name);
    this.nameIssue.set(null);
    this.dirty.set(true);
  }

  setDescription(description: string): void {
    this.description.set(description);
    this.descriptionIssue.set(null);
    this.dirty.set(true);
  }

  /**
   * The conditions of one entity mean nothing for another: a new root entity starts the tree over. Returns
   * a way back to what was there, for the toast's undo.
   */
  chooseRoot(key: string): (() => void) | null {
    const previous = { rootEntity: this.rootEntity(), draft: this.draft() };
    if (key === previous.rootEntity) {
      return null;
    }
    const fresh = newDraft(this.ids);
    this.rootEntity.set(key);
    this.draft.set(fresh);
    this.serverErrors.set([]);
    this.liveErrors.set([]);
    this.awaitingFirstSentence = false;
    this.focus.set(null);
    this.dirty.set(true);
    return () => {
      // the way back is from the empty tree the change left: one that was built on, or replaced, stays
      if (this.draft() !== fresh) {
        return;
      }
      this.rootEntity.set(previous.rootEntity);
      this.draft.set(previous.draft);
    };
  }

  /**
   * Applies one edit of the builder. A removal answers with what it took away and the way back to the draft
   * as it was, for the toast's undo: a group goes with every condition in it, and one press must not be final.
   */
  apply(edit: DraftEdit): Removal | null {
    const glossary = this.glossary();
    const rootEntity = this.rootEntity();
    if (!glossary || !rootEntity) {
      return null;
    }
    const before = { draft: this.draft(), serverErrors: this.serverErrors(), liveErrors: this.liveErrors() };
    const mark = edit.kind === 'remove' ? this.marks().get(edit.target) : undefined;
    const result = applyEdit(this.draft(), edit, { glossary, rootEntity, ids: this.ids });
    this.draft.set(result.draft);
    this.dirty.set(true);
    if (result.focus) {
      this.focus.set(result.focus);
    }
    this.awaitingFirstSentence = false;
    // what the server said about a row stands until the row is edited or is gone
    const present = new Set(orderedNodeIds(result.draft));
    const edited = 'id' in edit ? edit.id : null;
    const stands = ({ location }: LocatedError) =>
      location.nodeId === undefined || (present.has(location.nodeId) && location.nodeId !== edited);
    this.serverErrors.update((errors) => errors.filter(stands));
    this.liveErrors.update((errors) => errors.filter(stands));
    if (edit.kind !== 'remove' || result.draft === before.draft) {
      return null;
    }
    const after = result.draft;
    return {
      mark,
      undo: () => {
        // the way back is from the draft the removal left: a draft that was edited, saved over by a reload
        // or started over since is not replaced
        if (this.draft() !== after) {
          return;
        }
        this.draft.set(before.draft);
        this.serverErrors.set(before.serverErrors);
        this.liveErrors.set(before.liveErrors);
        this.focus.set(null);
      },
    };
  }

  // ---------------------------------------------------------------- the sentence

  /** Asks the engine again for the sentence of the same draft: the way out of an engine that did not answer. */
  revalidate(): void {
    this.sentenceFailure.set(null);
    this.validateAgain.update((count) => count + 1);
  }

  /**
   * The validate loop. An unfinished draft sends nothing and dims the sentence at once. A complete one
   * asks the engine 400ms after the last edit; the next edit cancels the wait and the request, so an older
   * answer never replaces a newer one. While a complete draft waits for its answer the sentence is not
   * dimmed, so typing does not make it flicker.
   */
  private watchSentence(): void {
    // one question per definition and per "ask again": an edit that leaves the rule as it was asks nothing
    const asked = computed<Question | null>(
      () => {
        const definition = this.definition();
        return definition ? { definition, text: JSON.stringify(definition), again: this.validateAgain() } : null;
      },
      { equal: (a, b) => a?.text === b?.text && a?.again === b?.again },
    );
    toObservable(asked)
      .pipe(
        switchMap((question) => {
          if (question === null) {
            return of<Validation>({ kind: 'incomplete' });
          }
          const { definition } = question;
          return timer(VALIDATE_DEBOUNCE_MS).pipe(
            switchMap(() => this.controlsApi.validate(definition)),
            map((answer): Validation => ({ kind: 'valid', parts: answer.sentenceParts })),
            catchError((error: unknown) => of<Validation>({ kind: 'failed', error: toApiError(error), definition })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((validation) => this.onValidation(validation));
  }

  private onValidation(validation: Validation): void {
    if (validation.kind === 'valid') {
      this.settle(changedNodes(this.sentence().parts, validation.parts));
      this.sentence.set({ parts: validation.parts, stale: false });
      this.liveErrors.set([]);
      this.sentenceFailure.set(null);
      this.awaitingFirstSentence = false;
      return;
    }
    this.sentence.update((sentence) => ({ ...sentence, stale: true }));
    if (validation.kind === 'incomplete') {
      this.liveErrors.set([]);
      return;
    }
    if (validation.error.code !== 'DEFINITION_INVALID') {
      // the engine did not answer: nothing is known yet about the definition
      this.sentenceFailure.set(validation.error);
      return;
    }
    const located = locateErrors(validation.error, validation.definition);
    this.sentenceFailure.set(null);
    if (this.awaitingFirstSentence) {
      // a stored control that no longer validates: said at once, on its rows
      this.outdated.set(true);
      this.serverErrors.set(located);
    } else {
      this.liveErrors.set(located);
    }
    this.awaitingFirstSentence = false;
  }

  private settle(changed: Set<string>): void {
    clearTimeout(this.settleTimer);
    this.settling.set(changed);
    if (changed.size > 0) {
      this.settleTimer = setTimeout(() => this.settling.set(new Set()), SETTLE_MS);
    }
  }

  // ---------------------------------------------------------------- saving

  /** Saves the control, and with `run` runs it. Nothing is sent while a detail or a row is unfinished. */
  async save(run = false): Promise<SaveOutcome> {
    const definition = this.definition();
    if (!this.checkDetails() || !definition) {
      this.showErrors.set(true);
      this.focusFirstIssue();
      return { kind: 'invalid' };
    }
    if (this.saveState() !== 'idle') {
      return { kind: 'failed' };
    }
    const before = this.control();
    const sent: Sent = { name: this.name(), description: this.description(), draft: this.draft(), rootEntity: this.rootEntity() };
    const body = { name: sent.name.trim(), description: sent.description.trim() || null, definition };
    this.saveState.set('saving');
    this.failure.set(null);
    this.conflict.set(false);
    try {
      const saved = before
        ? await firstValueFrom(
            this.controlsApi.update(before.id, { ...body, concurrencyToken: before.concurrencyToken }),
          )
        : await firstValueFrom(this.controlsApi.create(body));
      this.onSaved(saved, sent);
      if (!run) {
        return { kind: 'saved', control: saved, created: !before, newVersion: !!before && saved.version !== before.version };
      }
      this.saveState.set('running');
      return { kind: 'ran', control: saved, run: await firstValueFrom(this.runsApi.start(saved.id)) };
    } catch (error) {
      this.onSaveFailed(toApiError(error), definition);
      return { kind: 'failed' };
    } finally {
      this.saveState.set('idle');
    }
  }

  /** Archives the control; true when it left the list. */
  async archive(): Promise<boolean> {
    const control = this.control();
    if (!control) {
      return false;
    }
    try {
      await firstValueFrom(this.controlsApi.archive(control.id));
      this.dirty.set(false);
      return true;
    } catch (error) {
      this.failure.set(toApiError(error));
      return false;
    }
  }

  private checkDetails(): boolean {
    const name = this.name().trim();
    this.nameIssue.set(name === '' ? 'required' : name.length > NAME_MAX ? 'tooLong' : null);
    this.descriptionIssue.set(this.description().trim().length > DESCRIPTION_MAX ? 'tooLong' : null);
    return this.nameIssue() === null && this.descriptionIssue() === null;
  }

  private focusFirstIssue(): void {
    const check = this.check();
    const first = check ? orderedNodeIds(this.draft()).find((id) => check.issues.has(id)) : undefined;
    if (this.nameIssue() === null && this.descriptionIssue() === null && first !== undefined) {
      this.focus.set({ node: first, input: check!.issues.get(first)![0].input });
    }
  }

  private onSaved(saved: Control, sent: Sent): void {
    this.control.set(saved);
    // what was edited while the request was on its way is still unsaved, and stays as typed
    const untouched =
      this.name() === sent.name &&
      this.description() === sent.description &&
      this.draft() === sent.draft &&
      this.rootEntity() === sent.rootEntity;
    if (untouched) {
      this.name.set(saved.name);
      this.description.set(saved.description ?? '');
    }
    this.dirty.set(!untouched);
    this.showErrors.set(false);
    this.outdated.set(false);
    this.serverErrors.set([]);
  }

  private onSaveFailed(error: ApiError, definition: Definition): void {
    switch (error.code) {
      case 'DEFINITION_INVALID': {
        const located = locateErrors(error, definition);
        this.serverErrors.set(located);
        const first = located.find((entry) => entry.location.nodeId !== undefined)?.location;
        if (first) {
          this.focus.set({ node: first.nodeId, input: first.input });
        }
        return;
      }
      case 'CONCURRENCY_CONFLICT':
        this.conflict.set(true);
        return;
      case 'CONTROL_ARCHIVED':
        this.control.update((control) => control && { ...control, isActive: false });
        return;
      default:
        this.failure.set(error);
    }
  }
}
