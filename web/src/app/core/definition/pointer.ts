import { DefinitionError } from '../api/api.types';
import { Definition } from './definition.types';
import { NodeInput } from './draft.check';

/**
 * Where a definition error belongs in the editor: the row (a condition or a related node) and, when the
 * path names one, the input of that row. Semantic errors name the member the editor edits as one input;
 * schema-layer paths may end deeper (`…/left/path`) or on the node itself, and `DUPLICATE_NODE_ID` carries
 * no node id, so the path is resolved against the definition that was sent (contracts/errors.md).
 */
export interface ErrorLocation {
  readonly nodeId?: string;
  readonly input?: NodeInput;
  /** The item of a list or a range, from `params.index`. */
  readonly index?: number;
}

const INPUTS: readonly string[] = ['left', 'operator', 'value', 'values', 'right', 'relationship'];

function segments(pointer: string): string[] {
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function hasId(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

export function locateError(error: DefinitionError, definition: Definition): ErrorLocation {
  let current: unknown = definition;
  let nodeId: string | undefined;
  let afterNode: string | undefined;
  for (const segment of segments(error.path)) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return error.nodeId ? { nodeId: error.nodeId } : {};
    }
    current = (current as Record<string, unknown>)[segment];
    if (hasId(current)) {
      nodeId = current.id;
      afterNode = undefined;
    } else {
      afterNode ??= nodeId === undefined ? undefined : segment;
    }
  }
  const id = error.nodeId ?? nodeId;
  if (id === undefined) {
    return {};
  }
  const input = afterNode !== undefined && INPUTS.includes(afterNode) ? (afterNode as NodeInput) : undefined;
  const index = error.params['index'];
  return {
    nodeId: id,
    ...(input ? { input } : {}),
    ...(input && typeof index === 'number' ? { index } : {}),
  };
}
