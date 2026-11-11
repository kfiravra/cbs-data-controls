import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SuggestionItem } from '../../core/api/api.types';
import { DraftGroup } from '../../core/definition/draft';
import { DraftEdit } from '../../core/definition/draft.edit';
import { MarksService } from '../../core/definition/marks.service';
import { GlossaryLabelsService } from '../../core/glossary/glossary-labels.service';
import { fieldGroups, findEntity, relatedOptions } from '../../core/glossary/glossary.lookups';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ListChanges } from '../../core/list/list-changes';
import { BannerComponent } from '../../shared/banner/banner.component';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { ConditionBuilderComponent } from '../../shared/condition-builder/condition-builder.component';
import { EntityCardsComponent } from '../../shared/entity-cards/entity-cards.component';
import { EntityChainComponent } from '../../shared/entity-chain/entity-chain.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { InvalidDirective } from '../../shared/invalid/invalid.directive';
import { NotFoundComponent } from '../../shared/not-found/not-found.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { SentenceFieldComponent } from '../../shared/sentence-field/sentence-field.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { TextPartsComponent } from '../../shared/text-parts/text-parts.component';
import { ToastRef, ToastService } from '../../shared/toast/toast.service';
import { ClosedDrafts } from './closed-drafts';
import { DESCRIPTION_MAX, NAME_MAX } from './editor.messages';
import { EditorStore } from './editor.store';
import { EditorSnapshot, EditorTarget } from './editor.types';

const NEW = 'new';
/** How long the toast of a closed draft stands: twice a plain toast. */
const CLOSED_TOAST_MS = 12_000;

/**
 * The control editor, in the list's panel: the details, what the control checks (a card per entity of the
 * glossary, and how they connect), for a new control one row that opens what the engine would suggest about
 * that choice, the conditions of the violation, and at the foot of the panel the control in words with save
 * and run. The panel closes at once, also over a changed draft: a toast then offers the draft back. The
 * store holds the state and talks to the api; the page navigates and toasts.
 */
@Component({
  selector: 'app-control-editor-page',
  imports: [
    BannerComponent,
    ConditionBuilderComponent,
    EntityCardsComponent,
    EntityChainComponent,
    ErrorBannerComponent,
    IconComponent,
    InvalidDirective,
    MatFormField,
    MatInput,
    NotFoundComponent,
    PageHeadComponent,
    SentenceFieldComponent,
    SkeletonComponent,
    TextPartsComponent,
    TranslatePipe,
  ],
  providers: [EditorStore],
  templateUrl: './control-editor.page.html',
  host: { class: 'sheet__screen', '(window:beforeunload)': 'onBeforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlEditorPage {
  protected readonly store = inject(EditorStore);
  private readonly language = inject(LanguageService);
  private readonly labels = inject(GlossaryLabelsService);
  private readonly format = inject(FormatService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly listChanges = inject(ListChanges);
  private readonly closedDrafts = inject(ClosedDrafts);
  private readonly marksService = inject(MarksService);
  /** The address of the editor whose draft is on the screen (`/controls/new`, `/controls/12`). */
  private openPath: string | null = null;
  /** A changed draft that was left while its save was on its way: offered back if that save fails. */
  private heldWhileSaving: { readonly path: string; readonly snapshot: EditorSnapshot } | null = null;
  /**
   * The toast that offers a way back (from a removal, another choice of what to check, or a suggestion that
   * filled the conditions) and the draft that way back starts from. The offer stands only while that draft
   * is the one on the screen.
   */
  private undoOffer: { readonly toast: ToastRef; readonly draft: DraftGroup } | null = null;
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly descriptionInput = viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');
  private readonly cards = viewChild(EntityCardsComponent);

  /**
   * True once the panel was left. A save or a run that lands after that still says what it did, and moves
   * nowhere: its address would open the panel again.
   */
  private left = false;

  protected readonly nameMax = NAME_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  /** The control's id from the route, or `new`. */
  readonly id = input.required<string>();
  /** The id of a control to copy into a new one (`?from=`). */
  readonly from = input<string>();

  protected readonly title = computed(() => {
    if (this.store.archived()) {
      return 'editor.titleArchived';
    }
    return this.id() === NEW ? 'editor.titleNew' : 'editor.titleEdit';
  });

  /** A stored control is being read: its meta line is on its way. */
  protected readonly opening = computed(() => this.id() !== NEW && this.store.loadState() === 'loading');

  protected readonly meta = computed(() => {
    const control = this.store.control();
    return control
      ? (this.translate.instant('editor.meta', {
          version: control.version,
          when: this.format.when(control.updatedAt),
        }) as string)
      : undefined;
  });

  /** What the control returns, and what else its conditions may ask about, in the glossary's words. */
  protected readonly rootSummary = computed(() => {
    const glossary = this.store.glossary();
    const root = this.store.rootEntity();
    const entity = glossary && root ? findEntity(glossary, root) : undefined;
    if (!glossary || !entity) {
      return null;
    }
    const reachable = [
      ...fieldGroups(glossary, entity.key)
        .slice(1)
        .map((group) => this.labels.groupLabel(group)),
      ...relatedOptions(glossary, entity.key).map((relationship) => this.language.text(relationship.label)),
    ];
    return {
      entity: this.language.text(entity.label.plural),
      also: new Intl.ListFormat(this.language.locale, { type: 'conjunction' }).format(reachable),
    };
  });

  /** The one line under the sentence that names what is unfinished. */
  protected readonly status = computed<string | null>(() => {
    const status = this.store.status();
    const text = (key: string, params: object = {}) => this.translate.instant(key, params) as string;
    switch (status?.kind) {
      case 'incomplete':
        // before a first sentence the hint already says what is awaited: a warning over an untouched row
        // would be a reproach for a mistake nobody made. A save that was refused does name the row
        if (this.store.sentence().parts === null && !this.store.showErrors()) {
          return null;
        }
        return text('editor.status.incomplete', {
          mark: status.mark,
          reason: text(`editor.issueWhat.${status.issue.kind}`),
        });
      case 'tooManyValues':
        return text('editor.status.tooManyValues', { max: this.store.check()?.limits.maxTotalValues });
      case 'invalid': {
        const reason = text(`errors.definition.${status.error.code}`, status.error.params);
        return status.mark ? text('editor.status.invalid', { mark: status.mark, reason }) : reason;
      }
      default:
        return null;
    }
  });

  /**
   * Why the sentence field has no sentence yet: the engine did not answer, the conditions were refused, or
   * (the usual case) no condition is complete. The field must not promise a sentence "after the first
   * condition is complete" beside a condition that is.
   */
  protected readonly sentenceHint = computed(() => {
    if (this.store.sentenceFailure()) {
      return 'editor.sentence.hintUnavailable';
    }
    return this.store.status()?.kind === 'invalid' || this.store.treeErrors().length > 0
      ? 'editor.sentence.hintInvalid'
      : 'editor.sentence.hint';
  });

  /** Server errors that name no row, as sentences for one banner. */
  protected readonly treeErrors = computed(() =>
    this.store
      .treeErrors()
      .map((error) => this.translate.instant(`errors.definition.${error.code}`, error.params) as string)
      .join(' '),
  );

  protected readonly busy = computed(() => this.store.saveState() !== 'idle');

  /**
   * Whether the user opened the suggestions. Closed until their row is pressed; it then stays open through
   * every change of what to check, and closes when a suggestion is taken into the form.
   */
  protected readonly ideasOpen = signal(false);

  /** The list is on the screen: it was opened, and there is something to show or on its way. */
  protected readonly ideasShown = computed(
    () => this.ideasOpen() && (this.store.ideas.loading() || this.store.ideas.items().length > 0),
  );

  /** The marks of each suggestion's own conditions, for the colours of its rule in words. */
  protected readonly ideaMarks = computed(() =>
    this.store.ideas.items().map((idea) => this.marksService.of(idea.definition.where)),
  );

  /** What the row of the suggestions says: that they are computed, that there are none, or that it can be opened. */
  protected readonly ideasLabel = computed(() => {
    if (this.store.ideas.loading()) {
      return 'editor.ideas.loading';
    }
    return this.store.ideas.items().length > 0 ? 'editor.ideas.title' : 'editor.ideas.none';
  });

  /** An address that names no control (not `new`, not a positive integer), or a control that is not there. */
  protected readonly notFound = computed(
    () => this.target(this.id(), this.from()) === null || this.store.loadState() === 'notFound',
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.left = true;
      this.offerClosedDraft();
    });
    effect(() => {
      const id = this.id();
      const target = this.target(id, this.from());
      if (target) {
        untracked(() => this.show(target, `/controls/${id}`));
      }
    });
    // a closed draft asked back at the address this editor already stands at: no navigation says so
    effect(() => {
      const wanted = this.closedDrafts.wanted();
      if (wanted !== null && wanted === this.openPath) {
        untracked(() => {
          const target = this.target(this.id(), this.from());
          if (target) {
            this.show(target, wanted);
          }
        });
      }
    });
    // an offered way back is withdrawn as soon as the draft is another one: edited further, read again from
    // the server, started over. The store refuses such a way back as well; this takes its button away.
    effect(() => {
      const draft = this.store.draft();
      if (this.undoOffer && this.undoOffer.draft !== draft) {
        this.undoOffer.toast.dismiss();
        this.undoOffer = null;
      }
    });
  }

  private target(id: string, from: string | undefined): EditorTarget | null {
    if (id !== NEW) {
      return /^[1-9]\d*$/.test(id) ? { id: Number(id) } : null;
    }
    const suggested = (history.state as { suggestion?: SuggestionItem } | null)?.suggestion ?? null;
    return {
      id: null,
      from: from && /^[1-9]\d*$/.test(from) ? Number(from) : null,
      draft: suggested,
      copyName: (name) => this.translate.instant('editor.copyName', { name }) as string,
    };
  }

  /**
   * Opens what the address names, or brings back the draft that was closed there when the toast's undo
   * asked for it. A changed draft that this takes the place of is kept and offered back, after the one that
   * was asked for is in hand: there is room for one.
   */
  private show(target: EditorTarget, path: string): void {
    const closed = this.closedDrafts.take(path);
    // a first save moves the control to its own address: the same draft, which nothing takes the place of
    const sameControl = closed === null && target.id !== null && this.store.control()?.id === target.id;
    if (!sameControl) {
      this.offerClosedDraft();
      this.ideasOpen.set(false);
    }
    this.openPath = path;
    void (closed ? this.store.restore(closed) : this.store.open(target));
  }

  /**
   * The screen is left, or another control takes its place. A changed draft is not asked about: it is kept,
   * and a toast offers it back at its own address. While a save is on its way the draft is only held: it is
   * being stored, and it is offered back if that save then fails (`save`).
   */
  private offerClosedDraft(): void {
    const path = this.openPath;
    if (path === null || !this.store.dirty() || this.store.archived()) {
      return;
    }
    if (this.busy()) {
      this.heldWhileSaving = { path, snapshot: this.store.snapshot() };
    } else {
      this.offerBackClosed(path, this.store.snapshot());
    }
  }

  private offerBackClosed(path: string, snapshot: EditorSnapshot): void {
    this.closedDrafts.keep(path, snapshot);
    // longer than a plain toast: its button is the only way back, and it has to be reached
    this.toast.show(
      'editor.toast.closed',
      {},
      {
        labelKey: 'editor.toast.restore',
        run: () => {
          this.closedDrafts.ask(path);
          void this.router.navigateByUrl(path);
        },
      },
      CLOSED_TOAST_MS,
    );
  }

  /** The control this panel is about: the list gives the focus back to its row when the panel closes. */
  panelControl(): number | null {
    return this.store.control()?.id ?? null;
  }

  protected chooseRoot(key: string): void {
    // an opened list of suggestions stays open: it then shows the suggestions for the new choice
    const undo = this.store.chooseRoot(key);
    if (undo) {
      this.offerBack('editor.toast.whatChanged', {}, undo);
    }
  }

  /**
   * Opens or closes the suggestions. A list that is on the screen always closes, also while new suggestions
   * are on their way; a row with nothing to offer does not open.
   */
  protected toggleIdeas(): void {
    if (this.ideasShown()) {
      this.ideasOpen.set(false);
    } else if (this.store.ideas.items().length > 0) {
      this.ideasOpen.set(true);
    }
  }

  /** A suggestion fills the conditions; what was there is offered back for as long as the toast stands. */
  protected applyIdea(idea: SuggestionItem): void {
    this.ideasOpen.set(false);
    this.offerBack('editor.toast.ideaApplied', {}, this.store.applyIdea(idea));
  }

  /** An edit of the builder. A removal is offered back for as long as its toast stands. */
  protected edit(edit: DraftEdit): void {
    const removal = this.store.apply(edit);
    if (!removal) {
      return;
    }
    if (removal.mark === undefined) {
      this.offerBack('editor.toast.removedGroup', {}, removal.undo);
    } else {
      this.offerBack('editor.toast.removedCondition', { mark: removal.mark }, removal.undo);
    }
  }

  /** Says what was just taken away, with the way back to it; the offer belongs to the draft as it is now. */
  private offerBack(messageKey: string, params: Record<string, unknown>, undo: () => void): void {
    const toast = this.toast.show(messageKey, params, { labelKey: 'editor.toast.restore', run: undo });
    this.undoOffer = { toast, draft: this.store.draft() };
  }

  protected async save(run: boolean): Promise<void> {
    if (this.busy()) {
      return;
    }
    const outcome = await this.store.save(run);
    if (outcome.kind === 'invalid') {
      // the first offending input: a detail, then the choice of what to check, before a row (the store
      // points the builder at the row)
      const detail = this.store.nameIssue() ? this.nameInput() : this.store.descriptionIssue() ? this.descriptionInput() : null;
      if (detail) {
        detail.nativeElement.focus();
      } else if (this.store.rootIssue()) {
        this.cards()?.focus();
      }
    }
    if (outcome.kind === 'saved') {
      const { control, newVersion } = outcome;
      this.toast.show(newVersion ? 'editor.toast.savedVersion' : 'editor.toast.saved', { version: control.version });
    }
    // a first save gives the control its address, before anything else: the address of an unsaved control
    // (with its `from` or its suggestion) must not stay in the history, where Back would build a second copy
    const held = this.heldWhileSaving;
    this.heldWhileSaving = null;
    if (held && outcome.kind === 'failed' && this.store.dirty()) {
      // the panel was closed over a draft whose save then failed: it is not stored, so it is offered back
      // (a save that landed before its run failed left nothing unsaved, and offers nothing)
      this.offerBackClosed(held.path, held.snapshot);
    }
    if (this.left) {
      // the panel is gone: the list is told, so the control's row shows what was saved and what ran
      // (also after a save whose run then failed to start: the save itself stands)
      if (outcome.kind !== 'invalid') {
        this.listChanges.report();
      }
      return;
    }
    const saved = this.store.control();
    if (saved && this.id() === NEW) {
      await this.router.navigate(['/controls', saved.id], { replaceUrl: true });
    }
    if (outcome.kind === 'ran') {
      await this.router.navigate(['/runs', outcome.run.id]);
    }
  }

  protected duplicate(): void {
    void this.router.navigate(['/controls', NEW], { queryParams: { from: this.store.control()?.id } });
  }

  /** "Try again" on what could not be read: the control, a copy's source or the glossary are read once more. */
  protected reopen(): void {
    const target = this.target(this.id(), this.from());
    if (target) {
      void this.store.open(target, true);
    }
  }

  /** The browser's own prompt guards a draft that was changed and not saved. */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty()) {
      event.preventDefault();
    }
  }
}
