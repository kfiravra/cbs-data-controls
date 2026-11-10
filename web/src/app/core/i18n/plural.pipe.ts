import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from './language.service';
import { pluralKeys } from './plural';

/** `{{ 'list.count' | plural: n }}`: the counted form of a key, with the number formatted as `count`. */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  transform(baseKey: string, count: number, params: Record<string, unknown> = {}): string {
    const values = { ...params, count: new Intl.NumberFormat(this.language.locale).format(count) };
    for (const key of pluralKeys(baseKey, count, this.language.lang)) {
      const text: unknown = this.translate.instant(key, values);
      if (typeof text === 'string' && text !== key) {
        return text;
      }
    }
    return baseKey;
  }
}
