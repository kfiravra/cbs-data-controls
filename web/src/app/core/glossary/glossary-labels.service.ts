import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../i18n/language.service';
import { FieldGroup } from './glossary.lookups';

/**
 * Labels the pickers compose from glossary labels. Every word is the glossary's, in the interface language;
 * the only text of the client's own is the pattern that joins the two ends of a path.
 */
@Injectable({ providedIn: 'root' })
export class GlossaryLabelsService {
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  /**
   * The name of a group of fields: the entity itself for the scope's own fields, and for a path its
   * relationships read from the far end back to the scope.
   */
  groupLabel(group: FieldGroup): string {
    if (group.relationships.length === 0) {
      return this.language.text(group.entity.label.singular);
    }
    return group.relationships
      .map((relationship) => this.language.text(relationship.label))
      .reduce((owner, field) => this.translate.instant('editor.field.pathOf', { field, owner }) as string);
  }
}
