import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { contractGlossary } from '../../../testing/contracts';
import { problemInterceptor } from '../http/problem.interceptor';
import { GlossaryService } from './glossary.service';

describe('GlossaryService', () => {
  let http: HttpTestingController;
  let service: GlossaryService;
  const glossary = contractGlossary();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([problemInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(GlossaryService);
  });

  afterEach(() => http.verify());

  it('reads the glossary with one request however many screens ask for it', async () => {
    const first = service.load();
    const second = service.load();
    http.expectOne('/api/v1/glossary').flush(glossary);

    expect(await first).toEqual(glossary);
    expect(await second).toEqual(glossary);
    expect(await service.load()).toEqual(glossary);
    expect(service.glossary()).toEqual(glossary);
    expect(service.error()).toBeNull();
  });

  it('keeps the error of a failed load and reads again when asked again', async () => {
    const failed = service.load();
    http.expectOne('/api/v1/glossary').flush(
      { type: 'about:blank', title: 'ENGINE_UNAVAILABLE', status: 503, code: 'ENGINE_UNAVAILABLE', params: {}, correlationId: 'x' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(await failed).toBeNull();
    expect(service.glossary()).toBeNull();
    expect(service.error()?.code).toBe('ENGINE_UNAVAILABLE');

    const retried = service.load();
    http.expectOne('/api/v1/glossary').flush(glossary);

    expect(await retried).toEqual(glossary);
    expect(service.error()).toBeNull();
  });
});
