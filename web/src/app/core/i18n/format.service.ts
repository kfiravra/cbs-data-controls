import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { GlossaryField } from '../api/api.types';
import { Scalar } from '../definition/definition.types';
import { valueLabel } from '../glossary/glossary.lookups';
import { GlossaryService } from '../glossary/glossary.service';
import { LanguageService } from './language.service';

/** Used until the glossary is loaded; the glossary's own pattern for the language replaces it. */
const FALLBACK_DATE_PATTERN = 'dd.MM.yyyy';
const DAY_MS = 24 * 60 * 60 * 1000;

interface DayParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const two = (value: number) => String(value).padStart(2, '0');

/**
 * Dates, times and numbers in the client's own text. Dates follow the pattern the glossary gives for the
 * language, so a date in a page head and a date inside the engine's text look alike. Digits are Western.
 * Rendered text (sentences, reasons) is never formatted here: it arrives as the engine wrote it.
 */
@Injectable({ providedIn: 'root' })
export class FormatService {
  private readonly glossary = inject(GlossaryService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  /** A calendar date (`YYYY-MM-DD`), or the local day of a timestamp. */
  date(value: string): string {
    const parts = this.dayOf(value);
    const pattern = this.glossary.glossary()?.formats[this.language.lang]?.date ?? FALLBACK_DATE_PATTERN;
    return pattern
      .replace('yyyy', String(parts.year))
      .replace('MM', two(parts.month))
      .replace('dd', two(parts.day));
  }

  /** The local time of a timestamp, as `HH:mm`. */
  time(timestamp: string): string {
    const at = new Date(timestamp);
    return `${two(at.getHours())}:${two(at.getMinutes())}`;
  }

  /** Today and yesterday in words with the time; an earlier day as its date. */
  when(timestamp: string): string {
    const at = new Date(timestamp);
    const now = new Date();
    // calendar days, counted in UTC so a day with a clock change is still one day
    const dayNumber = (day: Date) => Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / DAY_MS;
    const daysBack = dayNumber(now) - dayNumber(at);
    if (daysBack <= 0) {
      return this.translate.instant('common.todayAt', { time: this.time(timestamp) });
    }
    return daysBack === 1
      ? this.translate.instant('common.yesterdayAt', { time: this.time(timestamp) })
      : this.date(timestamp);
  }

  number(value: number): string {
    return new Intl.NumberFormat(this.language.locale).format(value);
  }

  /** A duration in seconds with one decimal at most. */
  seconds(milliseconds: number): string {
    return new Intl.NumberFormat(this.language.locale, { maximumFractionDigits: 1 }).format(milliseconds / 1000);
  }

  /**
   * A raw value of a record (an identifying field of a violation), written as the engine writes values:
   * a number that names a record digit for digit, another number with separators, a date by the pattern,
   * an enum or a boolean by its glossary label, and nothing for a missing value. Without the glossary a
   * number is written digit for digit too: an identifying number is far more often a name than a quantity,
   * and a separator inside a record's number would be wrong.
   */
  value(value: Scalar | null, field: GlossaryField | undefined): string {
    if (value === null) {
      return '';
    }
    if (typeof value === 'number') {
      const text = !field || field.identifier ? String(value) : this.number(value);
      const unit = this.language.text(field?.unit);
      return unit ? `${text} ${unit}` : text;
    }
    if (field?.type === 'date' && typeof value === 'string') {
      return this.date(value);
    }
    const label = field ? valueLabel(field, value) : undefined;
    return label ? this.language.text(label) : String(value);
  }

  private dayOf(value: string): DayParts {
    const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (calendar) {
      return { year: Number(calendar[1]), month: Number(calendar[2]), day: Number(calendar[3]) };
    }
    const at = new Date(value);
    return { year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() };
  }
}
