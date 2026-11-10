/** The languages the interface ships in. Adding one is a row here, a translation file and its locale data. */
export const LANGUAGES = {
  he: { dir: 'rtl', locale: 'he-IL' },
} as const;

export type Language = keyof typeof LANGUAGES;

export const DEFAULT_LANGUAGE: Language = 'he';

/** A text of the glossary: one string per language. */
export type LocalizedText = Readonly<Record<string, string>>;
