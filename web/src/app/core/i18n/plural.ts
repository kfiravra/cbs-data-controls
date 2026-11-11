/**
 * Counted nouns without ICU: the plural category of the language picks a key suffix, and `.other` is the
 * fallback when the translation file has no key for that category. The special forms are written for whole
 * things ("one second"); a fraction is written as a number and takes the general form ("0.4 seconds").
 */
export function pluralKeys(baseKey: string, count: number, lang: string): string[] {
  const category = Number.isInteger(count) ? new Intl.PluralRules(lang).select(count) : 'other';
  return category === 'other' ? [`${baseKey}.other`] : [`${baseKey}.${category}`, `${baseKey}.other`];
}
