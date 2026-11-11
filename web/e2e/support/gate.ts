import { APIRequestContext, test as base, expect } from '@playwright/test';

import { Control, Health } from '../../src/app/core/api/api.types';
import { Example } from '../fixtures/examples';
import { glossary } from '../fixtures/glossary';

const lang = glossary.defaultLanguage;

/**
 * What a gate test may touch on the real stack: only controls it created itself. The list it runs on is
 * not its own: it may hold the six loaded examples under their real names, other people's controls, and
 * what an earlier gate run left behind. So every control a test creates is named with the test's tag, is
 * known by its id, and is archived when the test ends, also when it failed.
 */
export interface Gate {
  /** `e2e-` and six random base-36 characters: new for each test in each project. */
  readonly tag: string;
  /** The name of a control this test creates from an example: never the example's bare name. */
  nameOf(example: Example): string;
  /** Creates a control through the api, under a tagged name. */
  create(example: Example): Promise<Control>;
  /** Takes charge of a control the test created through the interface: it will be archived at the end. */
  own(id: number): void;
}

const HEADERS = { 'Accept-Language': lang, 'Content-Type': 'application/json' };

/** Archives one control and answers what went wrong, if anything: the teardown goes on to the next one. */
async function archive(request: APIRequestContext, id: number): Promise<string | null> {
  try {
    // a repeat answers 204, so a control the test already archived through the interface is no error
    const response = await request.delete(`/api/v1/controls/${id}`, { headers: HEADERS });
    return response.status() === 204 ? null : `control ${id}: status ${response.status()}`;
  } catch (error) {
    return `control ${id}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export const test = base.extend<{ gate: Gate }, { stack: Health }>({
  // health answers 200 also when the stack is degraded: the body says whether the gate can run at all
  stack: [
    async ({ playwright }, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? '';
      const api = await playwright.request.newContext({ baseURL });
      let health: Health;
      try {
        health = (await (await api.get('/api/v1/health')).json()) as Health;
      } catch {
        throw new Error(`the gate needs the api, the engine and the database: ${baseURL}/api/v1/health did not answer`);
      } finally {
        await api.dispose();
      }
      if (health.database !== 'ok' || health.engine !== 'ok') {
        throw new Error(
          `the gate needs a healthy stack at ${baseURL}: database is ${health.database}, engine is ${health.engine}`,
        );
      }
      await use(health);
    },
    { scope: 'worker', auto: true },
  ],

  gate: async ({ request }, use) => {
    const tag = `e2e-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    const created: number[] = [];
    const nameOf = (example: Example) => `${example.name[lang]} ${tag}`;
    await use({
      tag,
      nameOf,
      own: (id) => {
        created.push(id);
      },
      create: async (example) => {
        const response = await request.post('/api/v1/controls', {
          headers: HEADERS,
          data: { name: nameOf(example), description: example.description[lang], definition: example.definition },
        });
        expect(response.status(), `creating ${example.id}`).toBe(201);
        const control = (await response.json()) as Control;
        created.push(control.id);
        return control;
      },
    });
    // every control is tried, also after one of them failed: a failure must not leave the others active
    const failures: string[] = [];
    for (const id of created) {
      const failure = await archive(request, id);
      if (failure) {
        failures.push(failure);
      }
    }
    expect(failures, 'archiving the controls this test created').toEqual([]);
  },
});

export { expect };

/** The id of the control the editor shows, once a save gave it its address (`/controls/<id>`). */
export function controlIdOf(url: string): number {
  const id = /\/controls\/(\d+)(?:[?#]|$)/.exec(url)?.[1];
  if (!id) {
    throw new Error(`"${url}" is not the address of a saved control`);
  }
  return Number(id);
}
