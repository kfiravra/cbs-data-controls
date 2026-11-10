import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { contractGlossary } from '../../../testing/contracts';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations, t } from '../../../testing/translate';
import { Glossary } from '../api/api.types';
import { GlossaryService } from '../glossary/glossary.service';
import { FormatService } from './format.service';

describe('FormatService', () => {
  let format: FormatService;

  async function loadGlossary(glossary: Glossary): Promise<void> {
    const loading = TestBed.inject(GlossaryService).load();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/glossary').flush(glossary);
    await loading;
  }

  // local time of the machine that runs the spec: the service formats in the browser's zone
  const local = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(year, month - 1, day, hour, minute).toISOString();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTestTranslations()],
    });
    format = TestBed.inject(FormatService);
  });

  afterEach(() => vi.useRealTimers());

  it('writes a date by the pattern the glossary gives for the language', async () => {
    const glossary = contractGlossary();
    await loadGlossary({ ...glossary, formats: { he: { ...glossary.formats['he'], date: 'yyyy/MM/dd' } } });

    expect(format.date('2026-11-08')).toBe('2026/11/08');
    expect(format.date(local(2026, 3, 5, 14, 30))).toBe('2026/03/05');
  });

  it('writes a date with dots while the glossary is not loaded', () => {
    expect(format.date('2026-11-08')).toBe('08.11.2026');
  });

  it('writes the time of a timestamp as hours and minutes', () => {
    expect(format.time(local(2026, 11, 10, 9, 5))).toBe('09:05');
  });

  it('says today and yesterday in words with the time, and an earlier day as its date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10, 12, 0));

    expect(format.when(local(2026, 11, 10, 9, 12))).toBe(t('common.todayAt', { time: '09:12' }));
    expect(format.when(local(2026, 11, 9, 16, 40))).toBe(t('common.yesterdayAt', { time: '16:40' }));
    expect(format.when(local(2026, 11, 9, 0, 0))).toBe(t('common.yesterdayAt', { time: '00:00' }));
    expect(format.when(local(2026, 11, 8, 23, 59))).toBe('08.11.2026');
  });

  it('groups the digits of a number and keeps one decimal of a duration', () => {
    expect(format.number(6412)).toBe('6,412');
    expect(format.seconds(41)).toBe('0');
    expect(format.seconds(412)).toBe('0.4');
    expect(format.seconds(30000)).toBe('30');
  });

  it('writes a raw value as the engine writes values of that field', async () => {
    await loadGlossary(SYNTHETIC_GLOSSARY);
    const fields = SYNTHETIC_GLOSSARY.entities[0].fields;
    const field = (key: string) => fields.find((candidate) => candidate.key === key)!;

    expect(format.value(10432, field('order_number'))).toBe('10432');
    expect(format.value(15000, field('total'))).toBe(`15,000 ${field('total').unit!['he']}`);
    expect(format.value(15000, field('paid'))).toBe('15,000');
    expect(format.value('2026-01-31', field('placed_on'))).toBe('31.01.2026');
    expect(format.value('open', field('state'))).toBe(field('state').enumValues![0].label['he']);
    expect(format.value(false, field('urgent'))).toBe(field('urgent').valueLabels!.false['he']);
    expect(format.value('as stored', field('reference'))).toBe('as stored');
    expect(format.value(null, field('reference'))).toBe('');
    expect(format.value('unknown field', undefined)).toBe('unknown field');
  });
});
