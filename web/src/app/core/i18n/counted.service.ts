import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from './language.service';
import { pluralKeys } from './plural';

/**
 * A counted noun in the interface language: the plural form the language has for the count, with the count
 * written in as `count` (formatted, unless the caller gives its own text for it).
 */
@Injectable({ providedIn: 'root' })
export class CountedService {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  text(baseKey: string, count: number, params: Readonly<Record<string, unknown>> = {}): string {
    const values = { count: new Intl.NumberFormat(this.language.locale).format(count), ...params };
    for (const key of pluralKeys(baseKey, count, this.language.lang)) {
      const text: unknown = this.translate.instant(key, values);
      if (typeof text === 'string' && text !== key) {
        return text;
      }
    }
    return baseKey;
  }
}
