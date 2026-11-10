import { inject, provideEnvironmentInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

import { registerIcons } from '../app/core/icons/icons';

/** Registers the bundled icons, as the app does at start, so a component spec draws them without a request. */
export function provideTestIcons() {
  return provideEnvironmentInitializer(() => registerIcons(inject(MatIconRegistry), inject(DomSanitizer)));
}
