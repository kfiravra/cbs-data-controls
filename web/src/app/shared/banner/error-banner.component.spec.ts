import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestIcons } from '../../../testing/icons';
import { provideTestTranslations, t } from '../../../testing/translate';
import { ApiError } from '../../core/api/api-error';
import { ErrorBannerComponent } from './error-banner.component';

describe('ErrorBannerComponent', () => {
  let fixture: ComponentFixture<ErrorBannerComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  async function show(error: ApiError, retryable = true): Promise<void> {
    fixture.componentRef.setInput('error', error);
    fixture.componentRef.setInput('retryable', retryable);
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
      providers: [provideTestTranslations(), provideTestIcons()],
    });
    fixture = TestBed.createComponent(ErrorBannerComponent);
  });

  it('says what happened and what still works in the words of the code, never the code itself', async () => {
    await show(new ApiError(503, 'ENGINE_UNAVAILABLE'));

    expect(host().textContent).toContain(t('errors.ENGINE_UNAVAILABLE.title'));
    expect(host().textContent).toContain(t('errors.ENGINE_UNAVAILABLE.body'));
    expect(host().textContent).not.toContain('ENGINE_UNAVAILABLE');
    expect(host().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('fills the text of a code with its params', async () => {
    await show(new ApiError(504, 'QUERY_TIMEOUT', { timeoutSeconds: 30 }));

    expect(host().textContent).toContain(t('errors.QUERY_TIMEOUT.title', { timeoutSeconds: 30 }));
  });

  it('offers to try again, and tells its screen when the user does', async () => {
    await show(new ApiError(0, 'NETWORK_ERROR'));
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);

    const button = host().querySelector('button')!;
    button.click();

    expect(button.textContent?.trim()).toBe(t('common.retry'));
    expect(retried).toBe(1);
  });

  it('offers nothing when trying again cannot help', async () => {
    await show(new ApiError(409, 'CONTROL_ARCHIVED', { id: 4 }), false);

    expect(host().querySelector('button')).toBeNull();
  });
});
