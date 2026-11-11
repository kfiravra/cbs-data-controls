import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SuggestionItem } from '../../core/api/api.types';
import { DraftEdit } from '../../core/definition/draft.edit';
import { GlossaryLabelsService } from '../../core/glossary/glossary-labels.service';
import { fieldGroups, findEntity, relatedOptions } from '../../core/glossary/glossary.lookups';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BannerComponent } from '../../shared/banner/banner.component';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { ConditionBuilderComponent } from '../../shared/condition-builder/condition-builder.component';
import { confirm } from '../../shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { InvalidDirective } from '../../shared/invalid/invalid.directive';
import { NotFoundComponent } from '../../shared/not-found/not-found.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { RelationshipMapComponent } from '../../shared/relationship-map/relationship-map.component';
import { SentenceFieldComponent } from '../../shared/sentence-field/sentence-field.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { TextPartsComponent } from '../../shared/text-parts/text-parts.component';
import { ToastService } from '../../shared/toast/toast.service';
import { EditorStore } from './editor.store';
import { EditorTarget } from './editor.types';

const NEW = 'new';
const NAME_MAX = 200;
const DESCRIPTION_MAX = 1000;

/**
 * The control editor: details, the root entity on the relationship map, the conditions of the violation,
 * and beside them the control in words with save and run. The store holds the state and talks to the api;
 * the page navigates, confirms and toasts.
 */
@Component({
  selector: 'app-control-editor-page',
  imports: [
    BannerComponent,
    ConditionBuilderComponent,
    ErrorBannerComponent,
    IconComponent,
    InvalidDirective,
    MatFormField,
    MatInput,
    NotFoundComponent,
    PageHeadComponent,
    RelationshipMapComponent,
    RouterLink,
    SentenceFieldComponent,
    SkeletonComponent,
    TextPartsComponent,
    TranslatePipe,
  ],
  providers: [EditorStore],
  templateUrl: './control-editor.page.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlEditorPage {
  protected readonly store = inject(EditorStore);
  private readonly language = inject(LanguageService);
  private readonly labels = inject(GlossaryLabelsService);
  private readonly format = inject(FormatService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  /** Whether the toast on the screen offers to bring a removed condition or group back. */
  private undoOffered = false;
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly descriptionInput = viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');

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

  /** A stored control is being read: its meta line and its archive action are on their way. */
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

  /** An address that names no control (not `new`, not a positive integer), or a control that is not there. */
  protected readonly notFound = computed(
    () => this.target(this.id(), this.from()) === null || this.store.loadState() === 'notFound',
  );

  constructor() {
    effect(() => {
      const target = this.target(this.id(), this.from());
      if (target) {
        untracked(() => void this.store.open(target));
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

  protected chooseRoot(key: string): void {
    const undo = this.store.chooseRoot(key);
    if (undo) {
      this.undoOffered = false;
      this.toast.show('editor.toast.rootChanged', {}, { labelKey: 'editor.toast.restore', run: undo });
    }
  }

  /** An edit of the builder. A removal is offered back for as long as its toast stands. */
  protected edit(edit: DraftEdit): void {
    if (this.undoOffered) {
      // the way back leads to the draft as it was before the removal: after another edit it would undo that too
      this.toast.dismiss();
      this.undoOffered = false;
    }
    const removal = this.store.apply(edit);
    if (removal) {
      this.undoOffered = true;
      const restore = {
        labelKey: 'editor.toast.restore',
        run: () => {
          this.undoOffered = false;
          removal.undo();
        },
      };
      if (removal.mark === undefined) {
        this.toast.show('editor.toast.removedGroup', {}, restore);
      } else {
        this.toast.show('editor.toast.removedCondition', { mark: removal.mark }, restore);
      }
    }
  }

  /**
   * Asked by the router before another screen takes this one's place (`canDeactivate`). A changed draft
   * leaves only on the user's word, given to the browser's own prompt: the same guard as closing the tab,
   * and no dialog of the app.
   */
  mayLeave(): boolean {
    return !this.store.dirty() || window.confirm(this.translate.instant('editor.leave.confirm') as string);
  }

  protected async save(run: boolean): Promise<void> {
    if (this.busy()) {
      return;
    }
    const outcome = await this.store.save(run);
    if (outcome.kind === 'invalid') {
      // the first offending input: a detail before a row (the store points the builder at the row)
      const detail = this.store.nameIssue() ? this.nameInput() : this.store.descriptionIssue() ? this.descriptionInput() : null;
      detail?.nativeElement.focus();
    }
    if (outcome.kind === 'saved') {
      const { control, newVersion } = outcome;
      this.toast.show(newVersion ? 'editor.toast.savedVersion' : 'editor.toast.saved', { version: control.version });
    }
    // a first save gives the control its address, before anything else: the address of an unsaved control
    // (with its `from` or its suggestion) must not stay in the history, where Back would build a second copy
    const saved = this.store.control();
    if (saved && this.id() === NEW) {
      await this.router.navigate(['/controls', saved.id], { replaceUrl: true });
    }
    if (outcome.kind === 'ran') {
      await this.router.navigate(['/runs', outcome.run.id]);
    }
  }

  protected archive(): void {
    const control = this.store.control();
    if (!control) {
      return;
    }
    const text = (key: string, params: object = {}) => this.translate.instant(key, params) as string;
    confirm(this.dialog, {
      title: text('editor.archive.title'),
      body: text('editor.archive.body', { name: control.name }),
      confirmLabel: text('editor.archive.confirm'),
    }).subscribe((confirmed) => {
      if (confirmed) {
        void this.archiveConfirmed();
      }
    });
  }

  private async archiveConfirmed(): Promise<void> {
    if (await this.store.archive()) {
      this.toast.show('editor.toast.archived');
      await this.router.navigate(['/']);
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
