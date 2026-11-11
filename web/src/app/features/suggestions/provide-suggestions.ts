import { Provider, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { LanguageService } from '../../core/i18n/language.service';
import { SUGGESTIONS_OPENER, SuggestionsOpener } from '../../core/suggestions/suggestions-opener';

/**
 * Gives the application its suggestions panel. The panel is loaded when it is first opened, so the list
 * does not carry it.
 */
export function provideSuggestions(): Provider {
  return {
    provide: SUGGESTIONS_OPENER,
    useFactory: (): SuggestionsOpener => {
      const dialog = inject(MatDialog);
      const language = inject(LanguageService);
      return async () => (await import('./suggestions-dialog.component')).openSuggestions(dialog, language.dir);
    },
  };
}
