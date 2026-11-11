import { Glossary } from '../api/api.types';
import { GroupOp } from '../definition/definition.types';
import { LocalizedText } from '../i18n/language';

function isText(value: unknown): value is LocalizedText {
  return typeof value === 'object' && value !== null && Object.values(value).every((text) => typeof text === 'string');
}

/**
 * The word the engine joins the rows of a group with (`phrases.and`, `phrases.or`). The builder shows it
 * between two rows, so the rail says the same word the sentence will. It is the one phrase the client
 * reads; every other phrase and template is the engine's alone.
 */
export function joiningWord(glossary: Glossary, op: GroupOp): LocalizedText | undefined {
  const phrase = glossary.phrases[op];
  return isText(phrase) ? phrase : undefined;
}
