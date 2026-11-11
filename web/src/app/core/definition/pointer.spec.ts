import { contractInvalidFixtures } from '../../../testing/contracts';
import { DefinitionError } from '../api/api.types';
import { Definition } from './definition.types';
import { locateError } from './pointer';

const INPUTS = ['left', 'operator', 'value', 'values', 'right', 'relationship'];

describe('locateError', () => {
  it('leads every invalid fixture of the contracts to the node its path names', () => {
    const fixtures = contractInvalidFixtures();
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      const [, index, rest] = /^\/where\/children\/(\d+)(?:\/([^/]+))?/.exec(fixture.expected.path)!;
      const node = fixture.definition.where.children[Number(index)] as { id?: string };
      const error: DefinitionError = { code: fixture.expected.code, path: fixture.expected.path, params: {} };

      const located = locateError(error, fixture.definition);

      expect(located.nodeId, fixture.file).toBe(node.id);
      expect(located.input, fixture.file).toBe(rest && INPUTS.includes(rest) ? rest : undefined);
    }
  });

  it('prefers the node id the server sent over the path', () => {
    const fixture = contractInvalidFixtures()[0];
    const error: DefinitionError = { code: 'X', path: fixture.expected.path, nodeId: 'from_server', params: {} };

    expect(locateError(error, fixture.definition).nodeId).toBe('from_server');
  });

  it('finds a condition inside a related node and the item of a list the error names', () => {
    const definition: Definition = {
      schemaVersion: 1,
      rootEntity: 'order',
      where: {
        type: 'group',
        op: 'and',
        children: [
          { type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'above', value: 1 },
          {
            type: 'related',
            id: 'r1',
            relationship: 'order.lines',
            quantifier: 'any',
            where: {
              type: 'group',
              op: 'and',
              children: [{ type: 'condition', id: 'c2', left: { field: 'sku' }, operator: 'among', values: ['a', 7] }],
            },
          },
        ],
      },
    };

    expect(
      locateError(
        { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/1/where/children/0/values', params: { index: 1 } },
        definition,
      ),
    ).toEqual({ nodeId: 'c2', input: 'values', index: 1 });
    expect(locateError({ code: 'X', path: '/where/children/1/relationship', params: {} }, definition)).toEqual({
      nodeId: 'r1',
      input: 'relationship',
    });
  });

  it('names no node for an error of the whole tree or of the root entity', () => {
    const definition = contractInvalidFixtures()[0].definition;

    expect(locateError({ code: 'TOO_DEEP', path: '/where', params: {} }, definition)).toEqual({});
    expect(locateError({ code: 'UNKNOWN_ENTITY', path: '/rootEntity', params: {} }, definition)).toEqual({});
    expect(locateError({ code: 'X', path: '/where/children/99/value', params: {} }, definition)).toEqual({});
  });
});
