import { Page, Route } from '@playwright/test';

import {
  Control,
  ControlSummary,
  ControlVersion,
  DefinitionError,
  Glossary,
  LastRun,
  Page as ApiPage,
  Problem,
  ResultItem,
  Run,
  SuggestionItem,
  ValidateAnswer,
} from '../../src/app/core/api/api.types';
import { Definition } from '../../src/app/core/definition/definition.types';
import { exampleControls } from '../fixtures/examples';
import { glossary } from '../fixtures/glossary';
import { StoredRun, engine, succeededRun } from '../fixtures/runs';
import { suggestionItems } from '../fixtures/suggestions';

const API = '/api/v1';

export interface FakeProblem {
  readonly status: number;
  readonly body: Problem;
}

export function problem(
  status: number,
  code: string,
  params: Record<string, unknown> = {},
  errors?: readonly DefinitionError[],
): FakeProblem {
  return {
    status,
    body: {
      type: 'about:blank',
      title: code,
      status,
      code,
      params,
      ...(errors ? { errors } : {}),
      correlationId: '0123456789abcdef0123456789abcdef',
    },
  };
}

export interface ApiCall {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly body: unknown;
}

interface Answer {
  readonly status: number;
  readonly body?: unknown;
}

const ok = (body: unknown, status = 200): Answer => ({ status, body });

/**
 * The application api of contracts/api.md, in memory, answering `page.route`: the mocked specs reach no
 * service at any base URL. It keeps controls, versions and runs as the real api would, renders text with
 * the fake engine, and can be told to fail or to wait on one call. A call it does not know is aborted and
 * recorded in `unhandled`, which fails the test.
 */
export class FakeApi {
  glossary: Glossary = glossary;
  /** The first screen of the delivered system: the six examples, none of them run. */
  controls: Control[] = exampleControls();
  runs: StoredRun[] = [];
  suggestions: SuggestionItem[] = suggestionItems();
  readonly calls: ApiCall[] = [];
  readonly unhandled: string[] = [];

  private readonly versions = new Map<number, Definition[]>();
  private readonly failures = new Map<string, FakeProblem>();
  private readonly delays = new Map<string, number>();
  private readonly validations = new Map<string, FakeProblem | ValidateAnswer>();
  private nextId = 1000;

  /** Answers one call with a problem until `heal` is called: `fail('POST /controls/validate', problem(...))`. */
  fail(call: string, with_: FakeProblem): void {
    this.failures.set(call, with_);
  }

  heal(call: string): void {
    this.failures.delete(call);
  }

  /** Holds the answer of one call back, so a spec can look at the waiting state. */
  delay(call: string, milliseconds: number): void {
    this.delays.set(call, milliseconds);
  }

  /** Adds a stored run (see fixtures/runs.ts) and gives it back. */
  addRun(stored: StoredRun): StoredRun {
    this.runs.push(stored);
    return stored;
  }

  callsTo(call: string): ApiCall[] {
    return this.calls.filter((made) => `${made.method} ${made.path}` === call);
  }

  async install(page: Page): Promise<void> {
    await page.route(`**${API}/**`, (route) => this.handle(route));
  }

  // ---------------------------------------------------------------- routing

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(url.pathname.indexOf(API) + API.length);
    const method = request.method();
    const call = `${method} ${path}`;
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    this.calls.push({ method, path, query: url.searchParams, body });

    const wait = this.delays.get(call);
    if (wait) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    const failure = this.failures.get(call);
    const answer = failure ? { status: failure.status, body: failure.body } : this.answer(method, path, url.searchParams, body);
    if (!answer) {
      this.unhandled.push(call);
      await route.abort();
      return;
    }
    await route.fulfill({
      status: answer.status,
      contentType: answer.status >= 400 ? 'application/problem+json' : 'application/json',
      body: answer.body === undefined ? '' : JSON.stringify(answer.body),
    });
  }

  private answer(method: string, path: string, query: URLSearchParams, body: unknown): Answer | null {
    const route = `${method} ${path.replace(/\/\d+/g, '/:n')}`;
    const [first, second] = [...path.matchAll(/\/(\d+)/g)].map((match) => Number(match[1]));
    switch (route) {
      case 'GET /glossary':
        return ok(this.glossary);
      case 'GET /controls':
        return ok(this.list(query));
      case 'POST /controls':
        return ok(this.create(body as { name: string; description?: string | null; definition: Definition }), 201);
      case 'POST /controls/validate':
        return this.validate((body as { definition: Definition }).definition);
      case 'GET /controls/:n':
        return this.withControl(first, (control) => ok(control));
      case 'PUT /controls/:n':
        return this.withControl(first, (control) => this.update(control, body as Partial<Control>));
      case 'DELETE /controls/:n':
        return this.withControl(first, (control) => {
          this.replace({ ...control, isActive: false });
          return { status: 204 };
        });
      case 'GET /controls/:n/versions/:n':
        return this.withControl(first, (control) => this.version(control, second));
      case 'POST /controls/:n/runs':
        return this.withControl(first, (control) => this.run(control));
      case 'GET /runs/:n':
        return this.withRun(first, (stored) => ok(stored.run));
      case 'GET /runs/:n/results':
        return this.withRun(first, (stored) => ok(this.results(stored, query)));
      case 'POST /suggestions':
        return ok({ items: this.suggestions });
      case 'POST /suggestions/accept':
        return ok(
          { items: (body as { items: { name: string; description?: string; definition: Definition }[] }).items.map((item) => this.create(item)) },
          201,
        );
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- controls

  private withControl(id: number, then: (control: Control) => Answer): Answer {
    const control = this.controls.find((candidate) => candidate.id === id);
    return control ? then(control) : problem(404, 'CONTROL_NOT_FOUND', { id });
  }

  private replace(control: Control): void {
    this.controls = this.controls.map((candidate) => (candidate.id === control.id ? control : candidate));
  }

  private versionsOf(control: Control): Definition[] {
    if (!this.versions.has(control.id)) {
      this.versions.set(control.id, [control.definition]);
    }
    return this.versions.get(control.id)!;
  }

  private lastRunOf(control: Control): LastRun | null {
    const runs = this.runs.filter((stored) => stored.run.controlId === control.id).map((stored) => stored.run);
    const last = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id - a.id)[0];
    return last ? { id: last.id, startedAt: last.startedAt, status: last.status, totalCount: last.totalCount } : null;
  }

  private list(query: URLSearchParams): ApiPage<ControlSummary> {
    const search = (query.get('search') ?? '').toLowerCase();
    const active = query.get('active') ?? 'true';
    const rootEntity = query.get('rootEntity');
    const page = Number(query.get('page') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 25);
    const matching = this.controls
      .filter((control) => active === 'all' || control.isActive === (active === 'true'))
      .filter((control) => !rootEntity || control.rootEntity === rootEntity)
      .filter((control) => control.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'he') || a.id - b.id);
    const items = matching.slice((page - 1) * pageSize, page * pageSize).map((control) => {
      const { definition: _definition, concurrencyToken: _token, ...summary } = control;
      return { ...summary, lastRun: this.lastRunOf(control) } satisfies ControlSummary;
    });
    return { items, total: matching.length, page, pageSize };
  }

  private create(body: { name: string; description?: string | null; definition: Definition }): Control {
    const id = this.nextId++;
    const now = new Date().toISOString();
    const control: Control = {
      id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      rootEntity: body.definition.rootEntity,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      concurrencyToken: `token-${id}-1`,
      definition: body.definition,
    };
    this.controls.push(control);
    return control;
  }

  private update(control: Control, body: Partial<Control>): Answer {
    if (!control.isActive) {
      return problem(409, 'CONTROL_ARCHIVED', { id: control.id });
    }
    if (body.concurrencyToken !== control.concurrencyToken) {
      return problem(409, 'CONCURRENCY_CONFLICT', { id: control.id });
    }
    const changed = JSON.stringify(body.definition) !== JSON.stringify(control.definition);
    const sameDetails = body.name!.trim() === control.name && (body.description?.trim() || null) === control.description;
    if (!changed && sameDetails) {
      // nothing changed: the control as it is, and nothing written
      return ok(control);
    }
    const versions = this.versionsOf(control);
    if (changed) {
      versions.push(body.definition!);
    }
    const updated: Control = {
      ...control,
      name: body.name!.trim(),
      description: body.description?.trim() || null,
      rootEntity: body.definition!.rootEntity,
      definition: body.definition!,
      version: versions.length,
      updatedAt: new Date().toISOString(),
      concurrencyToken: `token-${control.id}-${Date.now()}`,
    };
    this.replace(updated);
    return ok(updated);
  }

  private version(control: Control, version: number): Answer {
    const definition = this.versionsOf(control)[version - 1];
    return definition
      ? ok({ version, createdAt: control.createdAt, definition } satisfies ControlVersion)
      : problem(404, 'VERSION_NOT_FOUND', { id: control.id, version });
  }

  /** Answers the live validate of one definition with a canned answer or problem, whatever it holds. */
  answerValidate(definition: Definition, with_: FakeProblem | ValidateAnswer): void {
    this.validations.set(JSON.stringify(definition), with_);
  }

  private validate(definition: Definition): Answer {
    const canned = this.validations.get(JSON.stringify(definition));
    if (canned) {
      return 'status' in canned ? canned : ok(canned);
    }
    return ok(engine.validate(definition));
  }

  // ---------------------------------------------------------------- runs

  private withRun(id: number, then: (stored: StoredRun) => Answer): Answer {
    const stored = this.runs.find((candidate) => candidate.run.id === id);
    return stored ? then(stored) : problem(404, 'RUN_NOT_FOUND', { id });
  }

  private run(control: Control): Answer {
    if (!control.isActive) {
      return problem(409, 'CONTROL_ARCHIVED', { id: control.id });
    }
    const previous = this.runs
      .map((stored) => stored.run)
      .filter((run: Run) => run.controlId === control.id && run.status === 'succeeded')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const stored = succeededRun(control, this.nextId++, {
      previousRun: previous ? { id: previous.id, startedAt: previous.startedAt, totalCount: previous.totalCount ?? 0 } : null,
    });
    this.runs.push(stored);
    return ok(stored.run, 201);
  }

  private results(stored: StoredRun, query: URLSearchParams): ApiPage<ResultItem> {
    const identifying = this.glossary.entities.find((entity) => entity.key === stored.run.rootEntity)?.identifyingFields ?? [];
    const displayText = (row: ResultItem) =>
      identifying
        .map((field) => row.display[field])
        .filter((value) => value !== null && value !== undefined)
        .join(' ');
    const search = (query.get('search') ?? '').trim().toLowerCase();
    const condition = query.get('condition');
    const direction = query.get('dir') === 'desc' ? -1 : 1;
    const byDisplay = query.get('sort') === 'display';
    const page = Number(query.get('page') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 25);
    const matching = stored.results
      .filter((row) => !condition || row.matched.includes(condition))
      .filter((row) => `${displayText(row)}\n${row.reasonText}`.toLowerCase().includes(search))
      .sort(
        (a, b) =>
          direction * ((byDisplay ? displayText(a).localeCompare(displayText(b), 'he') : 0) || a.seq - b.seq),
      );
    return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length, page, pageSize };
  }
}
