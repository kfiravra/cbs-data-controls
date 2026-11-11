import { Locator, Page, expect } from '@playwright/test';

import { GlossaryEntity, GlossaryField } from '../../src/app/core/api/api.types';
import {
  ConditionNode,
  Definition,
  FieldRef,
  GroupNode,
  ListValue,
  RelatedNode,
  Scalar,
} from '../../src/app/core/definition/definition.types';
import { glossary, label } from '../fixtures/glossary';
import { t } from './i18n';

interface Resolved {
  readonly field: GlossaryField;
  /** The label of the picker group the field stands in: the entity, or the path read from its far end. */
  readonly groupLabel: string;
}

function entity(key: string): GlossaryEntity {
  return glossary.entities.find((candidate) => candidate.key === key)!;
}

function relationship(key: string) {
  return glossary.relationships.find((candidate) => candidate.key === key)!;
}

function resolve(scope: string, ref: FieldRef): Resolved {
  const path = (ref.path ?? []).map(relationship);
  const owner = path.length > 0 ? entity(path.at(-1)!.to) : entity(scope);
  const groupLabel =
    path.length === 0
      ? label(owner.label.singular)
      : path.map((step) => label(step.label)).reduce((near, far) => t('editor.field.pathOf', { field: far, owner: near }));
  return { field: owner.fields.find((candidate) => candidate.key === ref.field)!, groupLabel };
}

function valueLabel(field: GlossaryField, value: Scalar): string {
  if (field.type === 'bool') {
    return label(field.valueLabels![value ? 'true' : 'false']);
  }
  return label(field.enumValues!.find((entry) => entry.value === value)!.label);
}

/**
 * Builds any definition through the editor, node by node, the way a user would: it adds the row, picks the
 * field by its glossary label and path, then the comparison, then the value or the other field, and for a
 * related node its quantity and relationship. It knows no example and no entity: one driver serves every
 * definition, which is what makes a run of the six examples a proof of a generic builder. With `keyboard`
 * it never uses the pointer: every control is focused and worked with keys.
 */
export class BuilderDriver {
  constructor(
    private readonly page: Page,
    private readonly keyboard = false,
  ) {}

  private get builder(): Locator {
    return this.page.getByTestId('condition-builder');
  }

  async build(definition: Definition): Promise<void> {
    await this.chooseRoot(definition.rootEntity);
    const root = this.builder.getByTestId('condition-group').first();
    await this.fillGroup(await this.keyOf(root), definition.where, definition.rootEntity);
  }

  /** The key the builder gave a group: its rows, its adders and its all/any control are named by it. */
  private async keyOf(group: Locator): Promise<string> {
    return (await group.getAttribute('data-group'))!;
  }

  // ---------------------------------------------------------------- what the control checks

  private async chooseRoot(key: string): Promise<void> {
    const options = this.page.getByTestId('root-entity');
    const wanted = this.page.getByRole('radio', { name: label(entity(key).label.plural) });
    if (!this.keyboard) {
      await wanted.click();
      await expect(wanted).toHaveAttribute('aria-checked', 'true');
      return;
    }
    // arrow keys walk the radio group and choose nothing; next is the left arrow in a right-to-left page. The
    // group's one tab stop is the chosen card, or the first while nothing is chosen; Space chooses
    await options.and(this.page.locator('[tabindex="0"]')).focus();
    for (let step = 0; step <= (await options.count()); step++) {
      if (await wanted.evaluate((card) => card === document.activeElement)) {
        break;
      }
      await this.page.keyboard.press('ArrowLeft');
    }
    await expect(wanted).toBeFocused();
    await this.page.keyboard.press('Space');
    await expect(wanted).toHaveAttribute('aria-checked', 'true');
  }

  // ---------------------------------------------------------------- groups

  private async fillGroup(key: string, definition: GroupNode, scope: string): Promise<void> {
    const toggle = this.builder.locator(`[data-op-of="${key}"]`);
    await this.press(toggle.getByRole('radio', { name: t(definition.op === 'and' ? 'editor.group.all' : 'editor.group.any') }));
    const nodes = this.builder.locator(`[data-parent="${key}"]`);
    // a new group holds one empty row: the first condition takes it, anything else replaces it
    for (const [index, child] of definition.children.entries()) {
      const takesBlank = index === 0 && child.type === 'condition';
      if (!takesBlank) {
        const adder = { condition: 'condition', group: 'group', related: 'related' }[child.type];
        await this.press(this.builder.locator(`[data-adder-of="${key}"][data-adder="${adder}"]`));
        await expect(nodes).toHaveCount(index === 0 ? 2 : index + 1);
      }
      const node = nodes.last();
      if (child.type === 'condition') {
        await this.fillCondition(node, child, scope);
      } else if (child.type === 'group') {
        await this.fillGroup(await this.keyOf(node), child, scope);
      } else {
        await this.fillRelated(node, child);
      }
      if (index === 0 && !takesBlank) {
        await this.press(nodes.first().getByTestId('remove-row'));
        await expect(nodes).toHaveCount(1);
      }
    }
  }

  private async fillRelated(node: Locator, definition: RelatedNode): Promise<void> {
    await this.choose(
      node.getByTestId('related-quantity').first(),
      this.page.getByRole('option', { name: t(`editor.related.${definition.quantifier}`), exact: true }),
    );
    await this.choose(
      node.getByTestId('related-relationship').first(),
      this.page.getByRole('option', { name: label(relationship(definition.relationship).label), exact: true }),
    );
    const rows = node.getByTestId('condition-group').first();
    await this.fillGroup(await this.keyOf(rows), definition.where, relationship(definition.relationship).to);
  }

  // ---------------------------------------------------------------- one condition

  private async fillCondition(row: Locator, definition: ConditionNode, scope: string): Promise<void> {
    const left = resolve(scope, definition.left);
    await this.choose(row.getByTestId('field-picker'), this.fieldOption(left));
    const operator = glossary.operators.find((candidate) => candidate.key === definition.operator)!;
    const operatorLabel = label(operator.label[left.field.type] ?? operator.label['default']);
    await this.choose(row.getByTestId('operator-picker'), this.page.getByRole('option', { name: operatorLabel, exact: true }));

    if (definition.right) {
      await this.press(row.getByTestId('compare-toggle'));
      await this.choose(row.getByTestId('value-field'), this.fieldOption(resolve(scope, definition.right)));
    } else if (operator.arity === 1) {
      await this.enterValue(row, left.field, definition.value!);
    } else if (operator.arity === 2) {
      await this.type(row.getByTestId('value-from'), String(definition.values![0]));
      await this.type(row.getByTestId('value-to'), String(definition.values![1]));
    } else if (operator.arity === 'list') {
      await this.enterList(row, left.field, definition.values!);
    }
  }

  private fieldOption(resolved: Resolved): Locator {
    return this.page
      .getByRole('group', { name: resolved.groupLabel, exact: true })
      .getByRole('option', { name: label(resolved.field.label), exact: true });
  }

  private async enterValue(row: Locator, field: GlossaryField, value: Scalar): Promise<void> {
    if (field.type === 'enum' || field.type === 'bool') {
      const option = this.page.getByRole('option', { name: valueLabel(field, value), exact: true });
      await this.choose(row.getByTestId('value-choice'), option);
    } else {
      await this.type(row.getByTestId('value-single'), String(value));
    }
  }

  private async enterList(row: Locator, field: GlossaryField, values: readonly ListValue[]): Promise<void> {
    if (field.type === 'enum') {
      const select = row.getByTestId('value-choices');
      const options = values.map((value) => this.page.getByRole('option', { name: valueLabel(field, value), exact: true }));
      if (this.keyboard) {
        await select.focus();
        await this.page.keyboard.press('Enter');
        for (const option of options) {
          await this.walkTo(option);
          await this.page.keyboard.press('Space');
        }
      } else {
        await select.click();
        for (const option of options) {
          await option.click();
        }
      }
      await this.page.keyboard.press('Escape');
      return;
    }
    for (const value of values) {
      await this.type(row.getByTestId('value-chip-input'), String(value));
      await this.page.keyboard.press('Enter');
    }
  }

  // ---------------------------------------------------------------- pointer or keys

  private async press(control: Locator): Promise<void> {
    if (!this.keyboard) {
      await control.click();
      return;
    }
    await control.focus();
    await this.page.keyboard.press('Enter');
  }

  private async type(input: Locator, text: string): Promise<void> {
    if (!this.keyboard) {
      await input.fill(text);
      return;
    }
    await input.focus();
    await this.page.keyboard.type(text);
  }

  /** Opens a select and takes one option; by keys: Home, then down to the option, then Enter. */
  private async choose(select: Locator, option: Locator): Promise<void> {
    if (!this.keyboard) {
      await select.click();
      await option.click();
      await expect(option).toBeHidden();
      return;
    }
    await select.focus();
    await this.page.keyboard.press('Enter');
    await this.walkTo(option);
    await this.page.keyboard.press('Enter');
    await expect(option).toBeHidden();
  }

  /** Moves the active option of an open list to `option` with Home and the down arrow. */
  private async walkTo(option: Locator): Promise<void> {
    await expect(option).toBeVisible();
    const position = await option.evaluate((element) => {
      const enabled = [...element.closest('[role="listbox"]')!.querySelectorAll('[role="option"]')].filter(
        (candidate) => candidate.getAttribute('aria-disabled') !== 'true',
      );
      return enabled.indexOf(element);
    });
    await this.page.keyboard.press('Home');
    for (let step = 0; step < position; step++) {
      await this.page.keyboard.press('ArrowDown');
    }
  }
}
