import { expect, test as base } from '@playwright/test';

import { FakeApi } from './routes';

/**
 * `test` for the mocked specs: every page gets the in-memory api before it loads anything, and a test
 * fails when the app made a call the fake api does not know. A spec arranges `api` (controls, runs,
 * failures) before `page.goto`.
 */
export const test = base.extend<{ api: FakeApi }>({
  api: [
    async ({ page }, use) => {
      const api = new FakeApi();
      await api.install(page);
      await use(api);
      expect(api.unhandled, 'api calls no fixture answers').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
