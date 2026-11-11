import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations, t } from '../../../testing/translate';
import { chainFor, rootEntities } from '../../core/glossary/glossary.lookups';
import { EntityChainComponent } from './entity-chain.component';

const ENTITIES = rootEntities(SYNTHETIC_GLOSSARY);

describe('EntityChainComponent', () => {
  let fixture: ComponentFixture<EntityChainComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const nodes = () => [...host().querySelectorAll<HTMLElement>('[data-testid="chain-node"]')];
  const links = () => [...host().querySelectorAll<HTMLElement>('[data-testid="chain-link"]')];

  async function draw(root: string | null): Promise<void> {
    fixture.componentRef.setInput('chain', chainFor(SYNTHETIC_GLOSSARY, root));
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EntityChainComponent],
      providers: [provideHttpClient(), provideTestTranslations()],
    });
    fixture = TestBed.createComponent(EntityChainComponent);
  });

  it('names every entity in glossary order, and says between two neighbours which holds many of the other', async () => {
    await draw(null);

    expect(nodes().map((node) => node.textContent?.trim())).toEqual(ENTITIES.map((entity) => entity.label.plural['he']));
    // order and customer are joined: each customer has many orders. Customer and line are not: a bare line
    const [customer, order] = [ENTITIES[1], ENTITIES[0]];
    expect(links().map((link) => link.textContent?.trim())).toEqual([
      t('editor.what.link', { one: customer.label.singular['he'], many: order.label.plural['he'] }),
      '',
    ]);
  });

  it('marks the entity that is chosen, and none while nothing is', async () => {
    await draw(null);
    expect(host().querySelectorAll('.is-chosen')).toHaveLength(0);

    await draw(ENTITIES[1].key);
    expect(nodes().map((node) => node.classList.contains('is-chosen'))).toEqual(ENTITIES.map((_, index) => index === 1));
  });

  it('is a list to read, named by its caption, with nothing in it to press', async () => {
    await draw(ENTITIES[0].key);

    const list = host().querySelector('ol')!;
    expect(host().querySelector(`#${list.getAttribute('aria-labelledby')}`)!.textContent).toBe(t('editor.what.chain'));
    expect(host().querySelectorAll('button, a, [tabindex], [role="radio"]')).toHaveLength(0);
  });
});
