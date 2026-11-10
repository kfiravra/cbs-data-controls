import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { GlossaryLabelsService } from '../../core/glossary/glossary-labels.service';
import { fieldGroups, findEntity, relatedOptions } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { ConditionBuilderComponent } from '../../shared/condition-builder/condition-builder.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { RelationshipMapComponent } from '../../shared/relationship-map/relationship-map.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { EditorStore } from './editor.store';

/** The control editor: the root entity on the relationship map, then the conditions of the violation. */
@Component({
  selector: 'app-control-editor-page',
  imports: [
    ConditionBuilderComponent,
    ErrorBannerComponent,
    PageHeadComponent,
    RelationshipMapComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  providers: [EditorStore],
  templateUrl: './control-editor.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlEditorPage implements OnInit {
  protected readonly store = inject(EditorStore);
  private readonly language = inject(LanguageService);
  private readonly labels = inject(GlossaryLabelsService);

  /** The control's id from the route; absent for a new control. */
  readonly id = input<string>();

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

  ngOnInit(): void {
    void this.store.startNew();
  }

  protected retry(): void {
    void this.store.startNew();
  }
}
