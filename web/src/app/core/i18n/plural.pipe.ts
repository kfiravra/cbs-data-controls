import { Pipe, PipeTransform, inject } from '@angular/core';

import { CountedService } from './counted.service';

/** `{{ 'list.count' | plural: n }}`: the counted form of a key, with the number formatted as `count`. */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  private readonly counted = inject(CountedService);

  transform(baseKey: string, count: number, params: Record<string, unknown> = {}): string {
    return this.counted.text(baseKey, count, params);
  }
}
