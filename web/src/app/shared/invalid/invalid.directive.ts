import { Directive, effect, inject, input } from '@angular/core';
import { MatFormFieldControl } from '@angular/material/form-field';
import { Subject } from 'rxjs';

/** The part of a Material control this directive drives; the abstract type declares both read-only. */
interface ErrorStateHolder {
  errorState: boolean;
  readonly stateChanges: Subject<void>;
}

/**
 * Marks a Material control (an input, a select, a chip grid) invalid from the screen's own validation.
 * Material owns `aria-invalid` and the error look of its controls and derives both from an error state it
 * computes only for a forms control; a template binding of `aria-invalid` loses to its host binding. This
 * sets that error state instead, so assistive technology and the field's outline both follow.
 */
@Directive({ selector: '[appInvalid]' })
export class InvalidDirective {
  private readonly control = inject<MatFormFieldControl<unknown>>(MatFormFieldControl, { self: true });

  readonly appInvalid = input(false);

  constructor() {
    effect(() => {
      const holder = this.control as unknown as ErrorStateHolder;
      holder.errorState = this.appInvalid();
      holder.stateChanges.next();
    });
  }
}
