import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { marksOf } from './marks';

type Marked = Parameters<typeof marksOf>[0];

/**
 * Marks in the numbering of the interface language. The letters are language data, so they come from the
 * translation file (`common.markLetters`, separated by spaces) and no code names a letter.
 */
@Injectable({ providedIn: 'root' })
export class MarksService {
  private readonly translate = inject(TranslateService);
  private letters: readonly string[] | null = null;

  /** The mark of every condition and related node of a definition or a draft, by node id. */
  of(where: Marked): Map<string, string> {
    this.letters ??= (this.translate.instant('common.markLetters') as string).split(' ');
    return marksOf(where, this.letters);
  }
}
