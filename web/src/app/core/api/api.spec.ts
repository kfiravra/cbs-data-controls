import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { contractExamples } from '../../../testing/contracts';
import { languageInterceptor } from '../http/language.interceptor';
import { problemInterceptor } from '../http/problem.interceptor';
import { ApiError } from './api-error';
import { ControlsApi } from './controls.api';
import { GlossaryApi } from './glossary.api';
import { RunsApi } from './runs.api';
import { SuggestionsApi } from './suggestions.api';

describe('api layer', () => {
  let http: HttpTestingController;
  const definition = contractExamples()[0].definition;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([languageInterceptor, problemInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // the paths, methods and members below are those of contracts/api.md §4
  it('lists controls with only the query parameters that were given', () => {
    TestBed.inject(ControlsApi).list({ search: 'x', active: 'all', page: 2, pageSize: 25, rootEntity: '' }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/controls');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual(['active', 'page', 'pageSize', 'search']);
    expect(request.request.params.get('active')).toBe('all');
    request.flush({ items: [], total: 0, page: 2, pageSize: 25 });
  });

  it('reads, creates, updates and archives a control at its contract path', () => {
    const controls = TestBed.inject(ControlsApi);

    controls.get(7).subscribe();
    expect(http.expectOne('/api/v1/controls/7').request.method).toBe('GET');

    controls.create({ name: 'n', definition }).subscribe();
    const created = http.expectOne('/api/v1/controls');
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ name: 'n', definition });

    controls.update(7, { name: 'n', description: null, definition, concurrencyToken: 't' }).subscribe();
    const updated = http.expectOne('/api/v1/controls/7');
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body.concurrencyToken).toBe('t');

    controls.archive(7).subscribe();
    expect(http.expectOne('/api/v1/controls/7').request.method).toBe('DELETE');
  });

  it('validates a definition without storing it, and reads the definition of one version', () => {
    const controls = TestBed.inject(ControlsApi);

    controls.validate(definition).subscribe();
    const validated = http.expectOne('/api/v1/controls/validate');
    expect(validated.request.method).toBe('POST');
    expect(validated.request.body).toEqual({ definition });

    controls.version(7, 3).subscribe();
    expect(http.expectOne('/api/v1/controls/7/versions/3').request.method).toBe('GET');
  });

  it('starts a run with no run date, reads a run and pages its results', () => {
    const runs = TestBed.inject(RunsApi);

    runs.start(7).subscribe();
    const started = http.expectOne('/api/v1/controls/7/runs');
    expect(started.request.method).toBe('POST');
    expect(started.request.body).toEqual({});

    runs.get(41).subscribe();
    expect(http.expectOne('/api/v1/runs/41').request.method).toBe('GET');

    runs.results(41, { page: 1, pageSize: 25, condition: 'c2', sort: 'display', dir: 'desc', search: '' }).subscribe();
    const results = http.expectOne((candidate) => candidate.url === '/api/v1/runs/41/results');
    expect(results.request.params.keys().sort()).toEqual(['condition', 'dir', 'page', 'pageSize', 'sort']);
  });

  it('asks for suggestions and accepts the chosen ones as a list of items', () => {
    const suggestions = TestBed.inject(SuggestionsApi);

    suggestions.request().subscribe();
    expect(http.expectOne('/api/v1/suggestions').request.method).toBe('POST');

    suggestions.accept([{ name: 'n', description: 'd', definition }]).subscribe();
    const accepted = http.expectOne('/api/v1/suggestions/accept');
    expect(accepted.request.body).toEqual({ items: [{ name: 'n', description: 'd', definition }] });
  });

  it('says which language the interface is in on every api call, and on no other call', () => {
    TestBed.inject(GlossaryApi).get().subscribe();
    expect(http.expectOne('/api/v1/glossary').request.headers.get('Accept-Language')).toBe('he');

    TestBed.inject(HttpClient).get('/assets/i18n/he.json').subscribe();
    expect(http.expectOne('/assets/i18n/he.json').request.headers.has('Accept-Language')).toBe(false);
  });

  it('turns a problem into an error of codes and params, with its definition errors', () => {
    // the problem of contracts/api.md §5
    const problem = {
      type: 'about:blank',
      title: 'DEFINITION_INVALID',
      status: 422,
      code: 'DEFINITION_INVALID',
      params: {},
      errors: [
        { code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: { entity: 'e', field: 'f' } },
      ],
      correlationId: '5f2c0d8e9a7b4c1d8e3f6a2b7c9d0e1f',
    };
    let caught: unknown;

    TestBed.inject(ControlsApi).validate(definition).subscribe({ error: (error: unknown) => (caught = error) });
    http.expectOne('/api/v1/controls/validate').flush(problem, { status: 422, statusText: 'Unprocessable' });

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect([error.status, error.code, error.correlationId]).toEqual([422, 'DEFINITION_INVALID', problem.correlationId]);
    expect(error.definitionErrors).toEqual(problem.errors);
  });

  it('carries the params of a problem and no definition errors for another code', () => {
    let caught: unknown;

    TestBed.inject(ControlsApi).get(9).subscribe({ error: (error: unknown) => (caught = error) });
    http.expectOne('/api/v1/controls/9').flush(
      { type: 'about:blank', title: 'CONTROL_NOT_FOUND', status: 404, code: 'CONTROL_NOT_FOUND', params: { id: 9 }, correlationId: 'x' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(caught).toMatchObject({ status: 404, code: 'CONTROL_NOT_FOUND', params: { id: 9 } });
    expect((caught as ApiError).definitionErrors).toEqual([]);
  });

  it('derives NETWORK_ERROR when the api does not answer or answers with something that is not a problem', () => {
    const caught: unknown[] = [];
    const controls = TestBed.inject(ControlsApi);

    controls.get(1).subscribe({ error: (error: unknown) => caught.push(error) });
    http.expectOne('/api/v1/controls/1').error(new ProgressEvent('error'));
    controls.get(2).subscribe({ error: (error: unknown) => caught.push(error) });
    http.expectOne('/api/v1/controls/2').flush('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });

    expect(caught.map((error) => [(error as ApiError).status, (error as ApiError).code])).toEqual([
      [0, 'NETWORK_ERROR'],
      [502, 'NETWORK_ERROR'],
    ]);
  });
});
