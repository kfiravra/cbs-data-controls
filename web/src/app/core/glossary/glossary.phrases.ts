import { Glossary } from '../api/api.types';
import { GroupOp } from '../definition/definition.types';
import { LocalizedText } from '../i18n/language';
import { Brackets } from '../text/text-parts';

function isText(value: unknown): value is LocalizedText {
  return typeof value === 'object' && value !== null && Object.values(value).every((text) => typeof text === 'string');
}

/**
 * The word the engine joins the rows of a group with (`phrases.and`, `phrases.or`). The builder shows it
 * between two rows, so the rail says the same word the sentence will. The client reads this phrase and the
 * two marks of a group (`groupBrackets`); every other phrase and template is the engine's alone.
 */
export function joiningWord(glossary: Glossary, op: GroupOp): LocalizedText | undefined {
  const phrase = glossary.phrases[op];
  return isText(phrase) ? phrase : undefined;
}

/** The round brackets: what a group is opened and closed with until a glossary says otherwise. */
export const DEFAULT_BRACKETS: Brackets = { open: '(', close: ')' };

/**
 * The marks the engine opens and closes a group with, in a language (`phrases.groupOpen`, `phrases.groupClose`).
 * The default ones while the glossary is not read, or where it gives none for the language.
 */
export function groupBrackets(glossary: Glossary | null, lang: string): Brackets {
  const text = (name: string) => {
    const phrase = glossary?.phrases[name];
    return isText(phrase) ? (phrase[lang] ?? '').trim() : '';
  };
  const [open, close] = [text('groupOpen'), text('groupClose')];
  return open !== '' && close !== '' && open !== close ? { open, close } : DEFAULT_BRACKETS;
}
