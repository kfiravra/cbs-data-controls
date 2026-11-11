import { Definition, DefinitionNode } from '../../src/app/core/definition/definition.types';
import { FakeApi } from './routes';

/**
 * A definition with its node ids renamed by their place in the document. The editor gives its own ids, so
 * two definitions are the same rule when they are equal in this form.
 */
export function normalized(definition: Definition): Definition {
  let next = 0;
  const rename = (node: DefinitionNode): DefinitionNode => {
    if (node.type === 'group') {
      return { ...node, children: node.children.map(rename) };
    }
    const id = `n${++next}`;
    return node.type === 'related' ? { ...node, id, where: rename(node.where) as typeof node.where } : { ...node, id };
  };
  return { ...definition, where: rename(definition.where) as Definition['where'] };
}

/** The definition the editor last asked the engine about, in normalized form; null before any request. */
export function lastValidated(api: FakeApi): Definition | null {
  const call = api.callsTo('POST /controls/validate').at(-1);
  return call ? normalized((call.body as { definition: Definition }).definition) : null;
}
