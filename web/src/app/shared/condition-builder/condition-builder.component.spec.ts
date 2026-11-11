import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSelectHarness } from '@angular/material/select/testing';

import { provideTestIcons } from '../../../testing/icons';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations, t } from '../../../testing/translate';
import { Glossary } from '../../core/api/api.types';
import { DraftCondition, DraftGroup, IdSource } from '../../core/definition/draft';
import { checkDraft } from '../../core/definition/draft.check';
import { DraftEdit, FocusTarget, applyEdit, newDraft } from '../../core/definition/draft.edit';
import { marksOf } from '../../core/definition/marks';
import { BuilderView, RowMessage } from './builder-view';
import { ConditionBuilderComponent } from './condition-builder.component';

const GLOSSARY: Glossary = { ...SYNTHETIC_GLOSSARY, phrases: { and: { he: ' AND ' }, or: { he: ' OR ' } } };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const labelOf = (entity: string, field: string) =>
  GLOSSARY.entities.find((e) => e.key === entity)!.fields.find((f) => f.key === field)!.label['he'];
const operatorLabels = (keys: string[], variant = 'default') =>
  keys.map((key) => {
    const labels = GLOSSARY.operators.find((operator) => operator.key === key)!.label;
    return (labels[variant] ?? labels['default'])['he'];
  });

/** A screen in miniature: it keeps the draft and applies each edit the builder emits. */
@Component({
  imports: [ConditionBuilderComponent],
  template: `
    <app-condition-builder
      rootEntity="order"
      [draft]="draft()"
      [view]="view()"
      [focus]="focus()"
      (edit)="apply($event)"
      (advancedChange)="advanced.set($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  private readonly ids = new IdSource();
  readonly draft = signal<DraftGroup>(newDraft(this.ids));
  /** The advanced actions are asked for: the tests of groups and related records start from there. */
  readonly advanced = signal(true);
  readonly focus = signal<FocusTarget | null>(null);
  readonly messages = signal<ReadonlyMap<string, readonly RowMessage[]>>(new Map());
  readonly view = computed<BuilderView>(() => ({
    glossary: GLOSSARY,
    check: checkDraft(this.draft(), 'order', GLOSSARY, 'he'),
    marks: marksOf(this.draft(), LETTERS),
    messages: this.messages(),
    // as the editor's store says it: asked for, or the draft already holds more than a flat list
    advanced: this.advanced() || this.draft().children.some((child) => child.type !== 'condition'),
  }));

  apply(edit: DraftEdit): void {
    const result = applyEdit(this.draft(), edit, { glossary: GLOSSARY, rootEntity: 'order', ids: this.ids });
    this.draft.set(result.draft);
    this.focus.set(result.focus ?? null);
  }
}

describe('ConditionBuilderComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let loader: HarnessLoader;
  const host = () => fixture.nativeElement as HTMLElement;
  const all = (selector: string) => [...host().querySelectorAll<HTMLElement>(selector)];
  const rows = () => all('[data-testid="condition-row"]');
  const groups = () => all('[data-testid="condition-group"]');
  const marks = () => all('[data-testid="mark"]').map((mark) => mark.textContent);
  const adder = (kind: string, group = 0) =>
    host().querySelector<HTMLButtonElement>(
      `[data-adder-of="${groups()[group].getAttribute('data-group')}"][data-adder="${kind}"]`,
    )!;

  async function click(element: HTMLElement): Promise<void> {
    element.click();
    await fixture.whenStable();
  }

  async function select(testId: string, index = 0): Promise<MatSelectHarness> {
    return (await loader.getAllHarnesses(MatSelectHarness.with({ selector: `[data-testid="${testId}"]` })))[index];
  }

  async function pick(testId: string, text: string, index = 0): Promise<void> {
    const harness = await select(testId, index);
    await harness.open();
    await harness.clickOptions({ text });
    await fixture.whenStable();
  }

  async function optionTexts(testId: string, index = 0): Promise<string[]> {
    const harness = await select(testId, index);
    await harness.open();
    const texts = await Promise.all((await harness.getOptions()).map((option) => option.getText()));
    await harness.close();
    return texts;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTestTranslations(),
        provideTestIcons(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  describe('adding and removing', () => {
    it('adds a condition under the last one and letters the rows in order', async () => {
      await click(adder('condition'));
      await click(adder('condition'));

      expect(rows()).toHaveLength(3);
      expect(marks()).toEqual(['A', 'B', 'C']);
    });

    it('adds a nested group with one row of its own, and removes the whole group', async () => {
      await click(adder('group'));
      expect(groups()).toHaveLength(2);
      expect(rows()).toHaveLength(2);

      await click(host().querySelector<HTMLElement>('[data-testid="remove-group"]')!);
      expect(groups()).toHaveLength(1);
      expect(rows()).toHaveLength(1);
    });

    it('removes a nested group when its last row is removed', async () => {
      await click(adder('group'));

      await click(groups()[1].querySelector<HTMLElement>('[data-testid="remove-row"]')!);

      expect(groups()).toHaveLength(1);
    });

    it('keeps one empty row when the last row of the control is removed', async () => {
      await pick('field-picker', labelOf('order', 'total'));

      await click(host().querySelector<HTMLElement>('[data-testid="remove-row"]')!);

      expect(rows()).toHaveLength(1);
      expect(await (await select('field-picker')).isEmpty()).toBe(true);
    });

    it('re-letters the rows that follow a removed row', async () => {
      await click(adder('condition'));
      await click(adder('condition'));

      await click(rows()[0].querySelector<HTMLElement>('[data-testid="remove-row"]')!);

      expect(marks()).toEqual(['A', 'B']);
    });

    it('gives a related-records node its own mark before the rows inside it', async () => {
      await click(adder('related'));

      expect(all('[data-testid="related-node"]')).toHaveLength(1);
      expect(marks()).toEqual(['A', 'B', 'C']);
      expect(all('[data-testid="related-node"] [data-testid="mark"]')[0].textContent).toBe('B');
    });

    it('gives the letter of each row the colour of its place, the related node and the rows inside it too', async () => {
      await click(adder('related'));
      await click(adder('condition'));

      const tones = all('[data-testid="mark"]').map((mark) => [mark.textContent, mark.getAttribute('data-tone')]);
      expect(tones).toEqual([
        ['A', '1'],
        ['B', '2'],
        ['C', '3'],
        ['D', '4'],
      ]);
    });

    it('shows the joining word of the group between two rows, in the words of the glossary', async () => {
      await click(adder('condition'));
      expect(all('[data-testid="joiner"]').map((joiner) => joiner.textContent)).toEqual(['AND']);

      await click(all('[data-testid="group-op"] button')[1]);
      expect(all('[data-testid="joiner"]').map((joiner) => joiner.textContent)).toEqual(['OR']);
    });
  });

  describe('the comparison list', () => {
    it('is empty until a field is chosen', async () => {
      expect(await (await select('operator-picker')).isDisabled()).toBe(true);
    });

    it('holds only the comparisons the glossary allows for the field', async () => {
      await pick('field-picker', labelOf('order', 'reference'));
      expect(await optionTexts('operator-picker')).toEqual(operatorLabels(['same', 'among', 'absent']));

      await pick('field-picker', labelOf('order', 'score'));
      expect(await optionTexts('operator-picker')).toEqual(operatorLabels(['same', 'above']));
    });

    it('labels a comparison by the type of the field', async () => {
      await pick('field-picker', labelOf('order', 'placed_on'));

      expect((await optionTexts('operator-picker'))[0]).toBe(operatorLabels(['same'], 'date')[0]);
    });

    it('keeps the chosen comparison when the new field allows it, and clears it when it does not', async () => {
      await pick('field-picker', labelOf('order', 'total'));
      await pick('operator-picker', operatorLabels(['above'])[0]);

      await pick('field-picker', labelOf('order', 'paid'));
      expect(await (await select('operator-picker')).getValueText()).toBe(operatorLabels(['above'])[0]);

      await pick('field-picker', labelOf('order', 'reference'));
      expect(await (await select('operator-picker')).isEmpty()).toBe(true);
    });

    it('offers the fields of a related entity under the name of the relationship', async () => {
      const harness = await select('field-picker');
      await harness.open();
      const names = await Promise.all((await harness.getOptionGroups()).map((group) => group.getLabelText()));

      expect(names).toEqual([
        GLOSSARY.entities[0].label.singular['he'],
        'the customer',
        t('editor.field.pathOf', { field: 'the region', owner: 'the customer' }),
      ]);
    });
  });

  describe('the value input', () => {
    async function row(field: string, operator: string): Promise<void> {
      await pick('field-picker', labelOf('order', field));
      await pick('operator-picker', operatorLabels([operator])[0]);
    }
    const input = (testId: string) => host().querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);

    it('is a number input with the unit of the field for a number', async () => {
      await row('total', 'above');

      expect(input('value-single')!.getAttribute('inputmode')).toBe('decimal');
      expect(host().querySelector('.field__unit')!.textContent).toBe(GLOSSARY.entities[0].fields[2].unit!['he']);
    });

    it('is a date input for a date and a plain text input for text', async () => {
      await row('placed_on', 'above');
      expect(input('value-single')!.type).toBe('date');

      await row('reference', 'same');
      expect(input('value-single')!.type).toBe('text');
      expect(input('value-single')!.getAttribute('inputmode')).toBeNull();
    });

    it('is a choice of the glossary values for an enum and for a boolean', async () => {
      await row('state', 'same');
      expect(await optionTexts('value-choice')).toEqual(['open label', 'closed label']);

      await row('urgent', 'same');
      expect(await optionTexts('value-choice')).toEqual(['urgent yes', 'urgent no']);
    });

    it('is two inputs for a range and a list of values for a list', async () => {
      await row('total', 'within');
      expect(input('value-from')).not.toBeNull();
      expect(input('value-to')).not.toBeNull();

      await row('total', 'among');
      expect(input('value-chip-input')).not.toBeNull();
      expect(input('value-from')).toBeNull();
    });

    it('says that no value is needed for a comparison that takes none', async () => {
      await row('total', 'absent');

      expect(host().querySelector('[data-testid="value-none"]')!.textContent).toBe(t('editor.value.none'));
      expect(input('value-single')).toBeNull();
    });

    it('takes an emptied input as no value at all', async () => {
      await row('reference', 'same');
      const field = input('value-single')!;
      field.value = 'north';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      field.value = '';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect((fixture.componentInstance.draft().children[0] as DraftCondition).value).toBeUndefined();
    });

    it('adds a value to a list on Enter, once however often it is typed, and removes it by its button', async () => {
      await row('reference', 'among');
      const chips = () => all('[data-testid="value-chip"]').map((chip) => chip.querySelector('bdi')!.textContent);
      const add = async (text: string) => {
        const field = input('value-chip-input')!;
        field.value = text;
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        await fixture.whenStable();
      };

      await add('north');
      await add(' south ');
      await add('north');
      expect(chips()).toEqual(['north', 'south']);
      expect(input('value-chip-input')!.value).toBe('');

      await click(all('[data-testid="value-chip"] button')[0]);
      expect(chips()).toEqual(['south']);
    });

    it('is a choice of several glossary values for a list on an enum', async () => {
      await row('state', 'among');

      const harness = await select('value-choices');
      expect(await harness.isMultiple()).toBe(true);
      await harness.open();
      await harness.clickOptions({ text: 'open label' });
      await harness.clickOptions({ text: 'closed label' });
      await harness.close();
      await fixture.whenStable();

      expect(JSON.stringify(fixture.componentInstance.draft())).toContain('"values":["open","closed"]');
    });

    it('sends what is typed to the draft and shows it back', async () => {
      await row('total', 'above');
      const field = input('value-single')!;

      field.value = '15,000';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(JSON.stringify(fixture.componentInstance.draft())).toContain('"value":"15,000"');
      expect(input('value-single')!.value).toBe('15,000');
    });
  });

  describe('the comparison toggle', () => {
    const toggle = () => host().querySelector<HTMLButtonElement>('[data-testid="compare-toggle"]');

    it('turns the value into a field picker that offers the comparable fields of the same type', async () => {
      await pick('field-picker', labelOf('order', 'total'));
      await pick('operator-picker', operatorLabels(['above'])[0]);
      expect(toggle()!.getAttribute('aria-pressed')).toBe('false');

      await click(toggle()!);

      expect(toggle()!.getAttribute('aria-pressed')).toBe('true');
      expect(host().querySelector('[data-testid="value-single"]')).toBeNull();
      expect(await optionTexts('value-field')).toEqual([
        labelOf('order', 'order_number'),
        labelOf('order', 'paid'),
        labelOf('customer', 'credit'),
      ]);
    });

    it('relabels the comparison for two fields when the glossary has such a label', async () => {
      await pick('field-picker', labelOf('order', 'total'));
      await pick('operator-picker', operatorLabels(['above'])[0]);

      await click(toggle()!);

      expect(await (await select('operator-picker')).getValueText()).toBe(operatorLabels(['above'], 'field')[0]);
    });

    it('is not offered when the comparison or the field cannot compare two fields', async () => {
      await pick('field-picker', labelOf('order', 'total'));
      await pick('operator-picker', operatorLabels(['within'])[0]);
      expect(toggle()).toBeNull();

      await pick('field-picker', labelOf('order', 'score'));
      await pick('operator-picker', operatorLabels(['above'])[0]);
      expect(toggle()).toBeNull();
    });
  });

  describe('messages', () => {
    it('opens the mark of an unfinished row and says nothing under it until a message is given', async () => {
      expect(host().querySelector('[data-testid="mark"]')!.getAttribute('data-state')).toBe('open');
      expect(all('[data-testid="row-error"]')).toHaveLength(0);
    });

    it('puts a message under its row and marks the input it names', async () => {
      await pick('field-picker', labelOf('order', 'total'));
      await pick('operator-picker', operatorLabels(['above'])[0]);
      const id = rows()[0].getAttribute('data-node')!;

      fixture.componentInstance.messages.set(new Map([[id, [{ key: 'editor.issues.missingValue', input: 'value' }]]]));
      await fixture.whenStable();

      expect(all('[data-testid="row-error"]').map((error) => error.textContent?.trim())).toEqual([
        t('editor.issues.missingValue'),
      ]);
      expect(host().querySelector('[data-testid="value-single"]')!.getAttribute('aria-invalid')).toBe('true');
      expect(host().querySelector('[data-testid="field-picker"]')!.getAttribute('aria-invalid')).toBe('false');
    });

    it('says a row is invalid also when the row is drawn already refused', async () => {
      await pick('field-picker', labelOf('order', 'total'));
      const id = rows()[0].getAttribute('data-node')!;
      fixture.componentInstance.messages.set(new Map([[id, [{ key: 'editor.issues.missingValue', input: 'value' }]]]));

      // choosing the comparison draws the value input for the first time, with the message already there
      await pick('operator-picker', operatorLabels(['above'])[0]);

      expect(host().querySelector('[data-testid="value-single"]')!.getAttribute('aria-invalid')).toBe('true');
    });

    it('names each row as a group, so its three inputs are told apart from those of the next row', async () => {
      await click(adder('condition'));

      const names = all('[data-testid="condition-row"] [role="group"]').map(
        (group) => host().querySelector(`#${group.getAttribute('aria-labelledby')}`)!.textContent,
      );
      expect(names).toEqual([t('common.condition', { mark: 'A' }), t('common.condition', { mark: 'B' })]);
    });

    it('answers nothing to the pointer or the focus: the mark of a row is a badge', async () => {
      const row = rows()[0];
      const mark = row.querySelector('[data-testid="mark"]')!;
      const before = { state: mark.getAttribute('data-state'), classes: mark.className };

      row.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      row.dispatchEvent(new Event('pointerenter'));
      await fixture.whenStable();

      expect({ state: mark.getAttribute('data-state'), classes: mark.className }).toEqual(before);
    });
  });

  describe('simple and advanced', () => {
    const advanced = () => host().querySelector<HTMLButtonElement>('[data-testid="advanced"]');

    beforeEach(async () => {
      fixture.componentInstance.advanced.set(false);
      await fixture.whenStable();
    });

    it('is a flat list by default: one switch, one way to add a condition, and the advanced action', async () => {
      expect(all('[data-testid="group-op"]')).toHaveLength(1);
      expect(all('[data-adder]').map((button) => button.getAttribute('data-adder'))).toEqual(['condition']);
      expect(advanced()!.getAttribute('aria-pressed')).toBe('false');
      expect(advanced()!.textContent?.trim()).toBe(t('editor.add.advanced'));
    });

    it('offers groups and related records once the advanced action is pressed, and puts them away again', async () => {
      await click(advanced()!);

      expect(all('[data-adder]').map((button) => button.getAttribute('data-adder'))).toEqual([
        'condition',
        'group',
        'related',
      ]);
      expect(advanced()!.getAttribute('aria-pressed')).toBe('true');

      await click(advanced()!);

      expect(all('[data-adder]').map((button) => button.getAttribute('data-adder'))).toEqual(['condition']);
    });

    it('shows a draft that holds a group in full, and has nothing to put away while it does', async () => {
      await click(advanced()!);
      await click(adder('group'));
      fixture.componentInstance.advanced.set(false);
      await fixture.whenStable();

      expect(groups()).toHaveLength(2);
      expect(adder('group')).not.toBeNull();
      expect(advanced()).toBeNull();

      // the group goes, and the list is flat again: the action is back, as it was left
      await click(host().querySelector<HTMLElement>('[data-testid="remove-group"]')!);

      expect(groups()).toHaveLength(1);
      expect(advanced()!.getAttribute('aria-pressed')).toBe('false');
    });
  });
});
