import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeHe from '@angular/common/locales/he';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS } from '@angular/material/button-toggle';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { languageInterceptor } from './core/http/language.interceptor';
import { problemInterceptor } from './core/http/problem.interceptor';
import { DEFAULT_LANGUAGE } from './core/i18n/language';
import { TranslatedTitleStrategy } from './core/i18n/title.strategy';
import { provideIcons } from './core/icons/icons';
import { provideSuggestions } from './features/suggestions/provide-suggestions';

registerLocaleData(localeHe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([languageInterceptor, problemInterceptor])),
    { provide: LOCALE_ID, useValue: DEFAULT_LANGUAGE },
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
      fallbackLang: DEFAULT_LANGUAGE,
      lang: DEFAULT_LANGUAGE,
    }),
    // the first screen never renders its keys: the translations are in before the first render
    provideAppInitializer(() => firstValueFrom(inject(TranslateService).use(DEFAULT_LANGUAGE))),
    provideIcons(),
    provideSuggestions(),
    // the opening of a dialog is this app's own (`.app-dialog` in material-theme.scss), so Material's gets no
    // time; the closing is Material's fade, inside --duration-close (tokens.scss), which it times in script
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: { ...new MatDialogConfig(), enterAnimationDuration: '0ms', exitAnimationDuration: '120ms' },
    },
    // ink selects: the filled option is the signal, no check mark beside it
    {
      provide: MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS,
      useValue: { hideSingleSelectionIndicator: true, hideMultipleSelectionIndicator: true },
    },
  ],
};
