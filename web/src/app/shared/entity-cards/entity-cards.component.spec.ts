import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTestIcons } from '../../../testing/icons';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations } from '../../../testing/translate';
import { rootEntities } from '../../core/glossary/glossary.lookups';
import { EntityCardsComponent } from './entity-cards.component';

const ENTITIES = rootEntities(SYNTHETIC_GLOSSARY);

describe('EntityCardsComponent', () => {
  let fixture: ComponentFixture<EntityCardsComponent>;
  let chosen: string[];
  const host = () => fixture.nativeElement as HTMLElement;
  const cards = () => [...host().querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const press = (card: HTMLElement, key: string) => card.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  async function draw(inputs: Record<string, unknown> = {}): Promise<void> {
    for (const [name, value] of Object.entries({ entities: ENTITIES, chosen: null, labelledBy: 'question', ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EntityCardsComponent],
      providers: [provideHttpClient(), provideTestTranslations(), provideTestIcons()],
    });
    fixture = TestBed.createComponent(EntityCardsComponent);
    chosen = [];
    fixture.componentInstance.choose.subscribe((key) => chosen.push(key));
  });

  it('draws one card for each entity it is given, with the glossary\'s name and description of it', async () => {
    await draw();

    expect(cards()).toHaveLength(ENTITIES.length);
    ENTITIES.forEach((entity, index) => {
      expect(cards()[index].textContent).toContain(entity.label.plural['he']);
      expect(cards()[index].textContent).toContain(entity.description['he']);
    });
  });

  it('is one radio group named by the question, with nothing chosen until something is', async () => {
    await draw();
    const group = host().querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-labelledby')).toBe('question');
    expect(cards().map((card) => card.getAttribute('aria-checked'))).toEqual(ENTITIES.map(() => 'false'));
    // one tab stop: the first card while nothing is chosen
    expect(cards().map((card) => card.tabIndex)).toEqual(ENTITIES.map((_, index) => (index === 0 ? 0 : -1)));

    await draw({ chosen: ENTITIES[1].key });
    expect(cards().map((card) => card.getAttribute('aria-checked'))).toEqual(ENTITIES.map((_, index) => String(index === 1)));
    expect(cards().map((card) => card.tabIndex)).toEqual(ENTITIES.map((_, index) => (index === 1 ? 0 : -1)));
  });

  it('asks for the entity of the card that is pressed', async () => {
    await draw();

    cards()[2].click();

    expect(chosen).toEqual([ENTITIES[2].key]);
  });

  it('moves the focus with the arrows in the reading direction, round the ends, and chooses nothing', async () => {
    await draw({ chosen: ENTITIES[0].key });
    document.body.appendChild(host());
    const focused = () => cards().indexOf(document.activeElement as HTMLButtonElement);
    cards()[0].focus();

    // right to left: the left arrow goes forward
    press(cards()[0], 'ArrowLeft');
    expect(focused()).toBe(1);
    press(cards()[1], 'ArrowRight');
    press(cards()[0], 'ArrowUp');
    expect(focused()).toBe(ENTITIES.length - 1);
    press(cards().at(-1)!, 'ArrowDown');
    expect(focused()).toBe(0);
    press(cards()[0], 'Tab');

    // passing over a card is no choice: another choice would start a control's conditions over
    expect(chosen).toEqual([]);
    host().remove();
  });

  it('keeps one tab stop: the card the arrows stand on, and the chosen one again once the focus has left', async () => {
    await draw({ chosen: ENTITIES[0].key });
    document.body.appendChild(host());
    cards()[0].focus();

    press(cards()[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(cards().map((card) => card.tabIndex)).toEqual(ENTITIES.map((_, index) => (index === 1 ? 0 : -1)));

    cards()[1].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    await fixture.whenStable();
    expect(cards().map((card) => card.tabIndex)).toEqual(ENTITIES.map((_, index) => (index === 0 ? 0 : -1)));
    host().remove();
  });

  it('says that a choice is missing, and by which text, when it is told so', async () => {
    await draw({ invalid: true, describedBy: 'what-error' });

    const group = host().querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('aria-describedby')).toBe('what-error');
  });
});
