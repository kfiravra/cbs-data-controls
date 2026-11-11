import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { DEFAULT_LANGUAGE, LANGUAGES } from './app/core/i18n/language';

// Language and direction are bootstrap-time: set before the first render, fixed for the app's lifetime.
document.documentElement.lang = DEFAULT_LANGUAGE;
document.documentElement.dir = LANGUAGES[DEFAULT_LANGUAGE].dir;

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
