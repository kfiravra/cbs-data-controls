import { InjectionToken } from '@angular/core';

import { SuggestionItem } from '../api/api.types';

/** How a review of suggestions ended: controls were created, one draft goes to the editor, or nothing. */
export type SuggestionsOutcome =
  | { readonly kind: 'created'; readonly count: number }
  | { readonly kind: 'edit'; readonly item: SuggestionItem }
  | { readonly kind: 'closed' };

/**
 * Opens the suggestions dialog. A screen asks for it through this token, so the screen does not import the
 * feature that draws the dialog; the application provides the feature (app.config.ts).
 */
export type SuggestionsOpener = () => Promise<SuggestionsOutcome>;

export const SUGGESTIONS_OPENER = new InjectionToken<SuggestionsOpener>('SUGGESTIONS_OPENER');
