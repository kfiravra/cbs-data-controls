import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/** A route's `title` is a translation key; the document title is the product name and the page. */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    const app: string = this.translate.instant('app.name');
    const text: string = key
      ? this.translate.instant('app.title', { app, page: this.translate.instant(key) })
      : app;
    this.title.setTitle(text);
  }
}
