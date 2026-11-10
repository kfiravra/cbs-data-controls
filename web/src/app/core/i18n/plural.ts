/**
 * Counted nouns without ICU: the plural category of the language picks a key suffix, and `.other` is the
 * fallback when the translation file has no key for that category.
 */
export function pluralKeys(baseKey: string, count: number, lang: string): string[] {
  const category = new Intl.PluralRules(lang).select(count);
  return category === 'other' ? [`${baseKey}.other`] : [`${baseKey}.${category}`, `${baseKey}.other`];
}
