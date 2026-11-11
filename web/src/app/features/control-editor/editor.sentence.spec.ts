import { VALIDATE, editorHarness, letters, problem, sentenceOf } from '../../../testing/editor-store';
import { VALIDATE_DEBOUNCE_MS } from './editor.store';

describe('EditorStore: the validate loop', () => {
  let h: ReturnType<typeof editorHarness>;
  let http: ReturnType<typeof editorHarness>['http'];
  let store: ReturnType<typeof editorHarness>['store'];
  const settle = () => h.settle();
  const wait = (milliseconds: number) => h.wait(milliseconds);
  const firstRow = () => h.firstRow();
  const openComplete = () => h.openComplete();
  const answerValidate = (...args: Parameters<typeof h.answerValidate>) => h.answerValidate(...args);

  beforeEach(() => {
    h = editorHarness();
    ({ http, store } = h);
  });

  afterEach(() => h.finish());

  it('sends nothing for an unfinished draft', async () => {
    await h.openNew();
    store.apply({ kind: 'field', id: firstRow().id, left: { field: 'total' }, scope: 'order' });
    settle();

    wait(5 * VALIDATE_DEBOUNCE_MS);

    http.expectNone(VALIDATE);
    expect(store.sentence().parts).toBeNull();
  });

  it('asks for the sentence of a complete draft 400ms after the last edit, and not before', async () => {
    const id = await openComplete();

    wait(VALIDATE_DEBOUNCE_MS - 1);
    http.expectNone(VALIDATE);
    wait(1);
    const request = http.expectOne(VALIDATE);

    expect(request.request.body).toEqual({
      definition: {
        schemaVersion: 1,
        rootEntity: 'order',
        where: {
          type: 'group',
          op: 'and',
          children: [{ type: 'condition', id, left: { field: 'total' }, operator: 'above', value: 5 }],
        },
      },
    });
    request.flush({ valid: true, sentence: '', sentenceParts: sentenceOf([id, 'total above 5']), conditions: [] });
    expect(store.sentence()).toEqual({ parts: sentenceOf([id, 'total above 5']), stale: false });
  });

  it('keeps the last valid sentence, dimmed at once, when the draft becomes unfinished again', async () => {
    const id = await openComplete();
    answerValidate(sentenceOf([id, 'total above 5']));

    store.apply({ kind: 'value', id, value: undefined });
    settle();

    expect(store.sentence()).toEqual({ parts: sentenceOf([id, 'total above 5']), stale: true });
    wait(5 * VALIDATE_DEBOUNCE_MS);
    http.expectNone(VALIDATE);
  });

  it('does not dim the sentence while a complete draft waits for its answer', async () => {
    const id = await openComplete();
    answerValidate(sentenceOf([id, 'total above 5']));

    store.apply({ kind: 'value', id, value: '6' });
    settle();
    wait(VALIDATE_DEBOUNCE_MS);

    expect(store.sentence().stale).toBe(false);
    http.expectOne(VALIDATE).flush({ valid: true, sentence: '', sentenceParts: [], conditions: [] });
  });

  it('cancels the request of an older draft, so its answer never replaces a newer one', async () => {
    const id = await openComplete();
    wait(VALIDATE_DEBOUNCE_MS);
    const older = http.expectOne(VALIDATE);

    store.apply({ kind: 'value', id, value: '6' });
    settle();
    expect(older.cancelled).toBe(true);

    const newer = answerValidate(sentenceOf([id, 'total above 6']));
    expect(newer.request.body.definition.where.children[0].value).toBe(6);
    expect(store.sentence().parts).toEqual(sentenceOf([id, 'total above 6']));
  });

  it('restarts the wait on every edit, so typing sends one request', async () => {
    const id = await openComplete();

    wait(VALIDATE_DEBOUNCE_MS - 50);
    store.apply({ kind: 'value', id, value: '55' });
    settle();
    wait(VALIDATE_DEBOUNCE_MS - 50);
    http.expectNone(VALIDATE);

    wait(50);
    expect(http.expectOne(VALIDATE).request.body.definition.where.children[0].value).toBe(55);
  });

  it('dims the sentence and names the refused condition by its mark, with no error on its row', async () => {
    const id = await openComplete();
    answerValidate(sentenceOf([id, 'total above 5']));
    store.apply({ kind: 'value', id, value: '7' });
    settle();
    wait(VALIDATE_DEBOUNCE_MS);

    http
      .expectOne(VALIDATE)
      .flush(problem(422, 'DEFINITION_INVALID', [{ code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: id, params: {} }]), {
        status: 422,
        statusText: 'Unprocessable',
      });

    expect(store.sentence().stale).toBe(true);
    expect(store.status()).toMatchObject({ kind: 'invalid', mark: letters[0] });
    expect(store.messages().size).toBe(0);
    expect([...store.openNodes()]).toEqual([id]);
    expect(store.sentenceFailure()).toBeNull();
  });

  it('shows the failure when the engine does not answer, and asks again on retry', async () => {
    const id = await openComplete();
    wait(VALIDATE_DEBOUNCE_MS);
    http.expectOne(VALIDATE).flush(problem(503, 'ENGINE_UNAVAILABLE'), { status: 503, statusText: 'Unavailable' });
    expect(store.sentenceFailure()?.code).toBe('ENGINE_UNAVAILABLE');
    expect(store.sentence().stale).toBe(true);

    store.revalidate();
    settle();
    answerValidate(sentenceOf([id, 'total above 5']));

    expect(store.sentenceFailure()).toBeNull();
    expect(store.sentence().stale).toBe(false);
  });

  it('takes the failure away as soon as a sentence comes back, without being asked to try again', async () => {
    const id = await openComplete();
    wait(VALIDATE_DEBOUNCE_MS);
    http.expectOne(VALIDATE).flush(problem(503, 'ENGINE_UNAVAILABLE'), { status: 503, statusText: 'Unavailable' });

    store.apply({ kind: 'value', id, value: '6' });
    settle();
    answerValidate(sentenceOf([id, 'total above 6']));

    expect(store.sentenceFailure()).toBeNull();
  });

  it('flags the conditions whose clause was rewritten, once, for the settle', async () => {
    const id = await openComplete();
    answerValidate(sentenceOf([id, 'total above 5']));
    expect(store.settling().size).toBe(0);

    store.apply({ kind: 'value', id, value: '6' });
    settle();
    answerValidate(sentenceOf([id, 'total above 6']));
    expect([...store.settling()]).toEqual([id]);

    wait(1000);
    expect(store.settling().size).toBe(0);
  });
});
