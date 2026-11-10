import { Injectable } from '@angular/core';

import { DEFAULT_LANGUAGE, LANGUAGES, Language, LocalizedText } from './language';

/**
 * Holds the interface language as a value, so nothing else names a language. There is no switch in v1:
 * language and direction are fixed at bootstrap.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang: Language = DEFAULT_LANGUAGE;
  readonly dir = LANGUAGES[this.lang].dir;
  readonly locale = LANGUAGES[this.lang].locale;

  /** A glossary text in the interface language; empty when the glossary has none. */
  text(text: LocalizedText | null | undefined): string {
    return text?.[this.lang] ?? '';
  }
}
