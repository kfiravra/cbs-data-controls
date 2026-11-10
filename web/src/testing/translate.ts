import { EnvironmentProviders, Provider, inject, provideEnvironmentInitializer } from '@angular/core';
import { TranslateService, TranslationObject, provideTranslateService } from '@ngx-translate/core';
import { join } from 'node:path';

import { DEFAULT_LANGUAGE } from '../app/core/i18n/language';
import { WEB_ROOT, readJson } from './files';

type Texts = Record<string, unknown>;

const he = readJson<TranslationObject>(join(WEB_ROOT, 'src/assets/i18n/he.json'));

/** The real translation file, loaded with no request: a component spec reads the text the app would show. */
export function provideTestTranslations(): (Provider | EnvironmentProviders)[] {
  return [
    provideTranslateService({ fallbackLang: DEFAULT_LANGUAGE, lang: DEFAULT_LANGUAGE }),
    provideEnvironmentInitializer(() => inject(TranslateService).setTranslation(DEFAULT_LANGUAGE, he)),
  ];
}

/** The text of a key as the translation file holds it, with `{{name}}` placeholders filled. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  let node: unknown = he;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Texts)[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`he.json has no text for "${key}"`);
  }
  return node.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params[name] ?? ''));
}
