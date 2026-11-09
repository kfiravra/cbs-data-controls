---
paths:
  - "web/**/*.ts"
---

# TypeScript conventions for web/ (judgment calls only)

Already enforced by tooling, so do not restate them in reviews: strict TypeScript and strict template checks
through the Angular compiler, the angular-eslint rules, and `console.log` outside specs through the print guard.

- Standalone components with `ChangeDetectionStrategy.OnPush`; dependencies through `inject()`; no NgModules.
- State lives in signals: `signal()` for owned state, `computed()` for anything derived (never a stored copy),
  `effect()` only for side effects that leave Angular (storage, document attributes); `toSignal()` at the edge of
  an observable.
- Component API: `input()` / `input.required()`, `output()`, and `model()` for two-way binding; no `@Input` or
  `@Output` decorators.
- Templates use the built-in control flow (`@if`, `@for` with `track`, `@switch`); `track` by a stable id (the
  condition id), never `$index` in an editable list.
- Components never call `HttpClient`. Services do, return typed results and own the caching (the glossary).
- Every user-facing string is a translation key: dot-separated English grouped by screen (`list.*`, `editor.*`,
  `results.*`, `suggestions.*`), with `errors.<CODE>` and `reasons.<key>` mirroring `contracts/errors.md`. No Hebrew
  and no English prose in `.ts` or `.html`.
- API payload types mirror `contracts/api.md` in one place; `interface` for object shapes, `type` for unions; no
  `any`, and `unknown` plus narrowing at the boundary.
- The condition tree is immutable: an edit returns a new tree that shares the unchanged branches, so `computed()` and
  `OnPush` see it. Ids are created once with their node and never reused.
- Styles: logical properties only, colours and spacing from the design tokens in `docs/design.md`, no raw hex in a
  component.
- Tests: `*.spec.ts` next to the file; drive components through their DOM, inputs and outputs (Material test
  harnesses for the Material parts), never through private members.
