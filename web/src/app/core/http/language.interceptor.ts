import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { API_BASE } from '../api/api-error';
import { LanguageService } from '../i18n/language.service';

/** Every api call says which language the interface is in: rendered text comes back in it. */
export const languageInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE)) {
    return next(request);
  }
  const lang = inject(LanguageService).lang;
  return next(request.clone({ setHeaders: { 'Accept-Language': lang } }));
};
