import { SuggestionItem } from '../../src/app/core/api/api.types';
import { Definition, DefinitionNode } from '../../src/app/core/definition/definition.types';
import { loadSeed } from '../support/seed';
import { Example, examples } from './examples';
import { glossary, glossaryFile, label } from './glossary';
import { engine } from './runs';

/* eslint-disable @typescript-eslint/no-explicit-any -- the glossary file is read as loose JSON here */

const file = glossaryFile as any;
const lang = glossary.defaultLanguage;
const seed = loadSeed();

function nodes(node: DefinitionNode): DefinitionNode[] {
  if (node.type === 'group') {
    return node.children.flatMap(nodes);
  }
  return node.type === 'related' ? [node, ...nodes(node.where)] : [node];
}

/** The suggestion kind a definition has the shape of, and the labels its texts take (contracts/errors.md). */
function kindOf(definition: Definition): { kind: string; fills: Record<string, string> } {
  const root = glossary.entities.find((entity) => entity.key === definition.rootEntity)!;
  const fieldLabel = (key: string) => label(root.fields.find((field) => field.key === key)?.label);
  const relationshipLabel = (key: string) => label(glossary.relationships.find((r) => r.key === key)?.label);
  const all = nodes(definition.where);
  const fills: Record<string, string> = { entity: label(root.label.plural) };
  const related = all.find((node) => node.type === 'related');
  if (related?.type === 'related') {
    return { kind: 'active_without_active_children', fills: { ...fills, relationship: relationshipLabel(related.relationship) } };
  }
  const compared = all.find((node) => node.type === 'condition' && node.right);
  if (compared?.type === 'condition' && compared.right) {
    return {
      kind: 'date_order',
      fills: { ...fills, later: fieldLabel(compared.left.field), earlier: fieldLabel(compared.right.field) },
    };
  }
  const onPath = all.find((node) => node.type === 'condition' && node.left.path?.length);
  if (onPath?.type === 'condition') {
    return { kind: 'active_under_inactive', fills: { ...fills, relationship: relationshipLabel(onPath.left.path!.at(-1)!) } };
  }
  return { kind: 'missing_required', fills };
}

function filled(template: string, fills: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => fills[name] ?? '');
}

function suggestionOf(example: Example): SuggestionItem {
  const { kind, fills } = kindOf(example.definition);
  const root = (file.entities as any[]).find((entity) => entity.key === example.definition.rootEntity);
  const count = { count: String(example.expected.total), total: String(seed[root.table.name].length) };
  const rendered = engine.sentenceOf(example.definition);
  return {
    name: example.name[lang],
    description: example.description[lang],
    rationale: filled(file.suggestions.kinds[kind].rationale[lang], fills),
    evidence: [
      {
        key: 'violations_found',
        params: { count: example.expected.total, total: seed[root.table.name].length },
        text: filled(file.suggestions.evidence.violations_found[lang], count),
      },
    ],
    definition: example.definition,
    sentence: rendered.sentence,
    sentenceParts: rendered.sentenceParts,
  } satisfies SuggestionItem;
}

/** What the engine's heuristics propose over the sample data: the examples the contracts mark as heuristic. */
export function suggestionItems(): SuggestionItem[] {
  return examples.filter((example) => example.heuristic).map(suggestionOf);
}
