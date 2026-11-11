import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestIcons } from '../../../testing/icons';
import { BannerComponent } from './banner.component';

describe('BannerComponent', () => {
  let fixture: ComponentFixture<BannerComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BannerComponent], providers: [provideTestIcons()] });
    fixture = TestBed.createComponent(BannerComponent);
    fixture.componentRef.setInput('title', 'the title');
    await fixture.whenStable();
  });

  it('is announced politely by default and interrupts when it is urgent', async () => {
    expect(host().querySelector('[role="status"]')).not.toBeNull();

    fixture.componentRef.setInput('urgent', true);
    await fixture.whenStable();

    expect(host().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('shows its title and body, and no button when it has no action', async () => {
    fixture.componentRef.setInput('body', 'what still works');
    await fixture.whenStable();

    expect(host().textContent).toContain('the title');
    expect(host().textContent).toContain('what still works');
    expect(host().querySelector('button')).toBeNull();
  });

  it('emits its action when the one text button is pressed', async () => {
    let pressed = 0;
    fixture.componentInstance.action.subscribe(() => pressed++);
    fixture.componentRef.setInput('actionLabel', 'try again');
    await fixture.whenStable();

    const button = host().querySelector('button')!;
    button.click();

    expect(button.textContent?.trim()).toBe('try again');
    expect(pressed).toBe(1);
  });
});
