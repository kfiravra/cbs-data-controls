import { Locator, Page } from '@playwright/test';

import { DefinitionNode, GroupNode } from '../../src/app/core/definition/definition.types';
import { Example, exampleNumber } from '../fixtures/examples';
import { glossary, label } from '../fixtures/glossary';
import { BuilderDriver } from '../support/builder-driver';
import { t } from '../support/i18n';
import { expect, test } from '../support/mocked';
import { shot } from '../support/shots';

const letters = t('common.markLetters').split(' ');

/** The nodes that carry a mark, in the order their marks are given: a related node before its own rows. */
function marked(node: DefinitionNode): Exclude<DefinitionNode, GroupNode>[] {
  if (node.type === 'group') {
    return node.children.flatMap(marked);
  }
  return node.type === 'related' ? [node, ...marked(node.where)] : [node];
}

function fieldLabel(scope: string, field: string, path: readonly string[] = []): string {
  const owner = path.length > 0 ? glossary.relationships.find((r) => r.key === path.at(-1))!.to : scope;
  return label(glossary.entities.find((entity) => entity.key === owner)!.fields.find((f) => f.key === field)!.label);
}

/** What the builder must show for a definition: every marked node with its letter, and each row's field. */
async function expectBuilt(page: Page, example: Example): Promise<void> {
  const builder = page.getByTestId('condition-builder');
  const nodes = marked(example.definition.where);
  const rows = builder.locator('[data-testid="condition-row"], [data-testid="related-node"]');
  await expect(rows).toHaveCount(nodes.length);

  const marks = await builder.locator('.cond > app-mark, .group__how > app-mark').allTextContents();
  expect(marks).toEqual(letters.slice(0, nodes.length));

  let scope = example.definition.rootEntity;
  for (const [index, node] of nodes.entries()) {
    const row = rows.nth(index);
    if (node.type === 'related') {
      const relationship = glossary.relationships.find((r) => r.key === node.relationship)!;
      await expect(row.getByTestId('related-relationship').first()).toContainText(label(relationship.label));
      await expect(row.getByTestId('related-quantity').first()).toContainText(t(`editor.related.${node.quantifier}`));
      scope = relationship.to;
    } else {
      await expect(row.getByTestId('field-picker')).toContainText(fieldLabel(scope, node.left.field, node.left.path));
      await expect(row.locator('.mark--open')).toHaveCount(0);
    }
  }
}

async function open(page: Page): Promise<Locator> {
  await page.goto('/controls/new');
  const builder = page.getByTestId('condition-builder');
  await expect(builder.getByTestId('condition-row')).toHaveCount(1);
  return builder;
}

test.describe('condition builder', () => {
  test('builds example 6 with the pointer: a two-hop path and a nested group', async ({ page }, testInfo) => {
    const example = exampleNumber(6);
    await open(page);

    await new BuilderDriver(page).build(example.definition);

    await expectBuilt(page, example);
    await shot(page, testInfo, 'builder-example-6');
  });

  test('builds example 5 with the keyboard alone: another root entity and a related-records node', async ({ page }, testInfo) => {
    const example = exampleNumber(5);
    await open(page);

    await new BuilderDriver(page, true).build(example.definition);

    await expectBuilt(page, example);
    await shot(page, testInfo, 'builder-example-5');
  });

  test('builds example 4, a tree three groups deep', async ({ page }, testInfo) => {
    const example = exampleNumber(4);
    await open(page);

    await new BuilderDriver(page).build(example.definition);

    await expectBuilt(page, example);
    await shot(page, testInfo, 'builder-deep-tree');
  });

  test('starts a new control on the first root entity with one empty, open condition', async ({ page }) => {
    const builder = await open(page);
    const first = glossary.entities.find((entity) => entity.rootable)!;

    await expect(page.getByTestId('root-entity').and(page.locator('[aria-checked="true"]'))).toContainText(
      label(first.label.plural),
    );
    await expect(builder.locator('.cond > app-mark')).toHaveText(letters[0]);
    await expect(builder.locator('.cond > app-mark')).toHaveClass(/mark--open/);
    await expect(builder.getByTestId('row-error')).toHaveCount(0);
  });

  test('moves the focus to a new row, and back to the row before it when the row is removed', async ({ page }) => {
    const builder = await open(page);
    const rows = builder.getByTestId('condition-row');

    await builder.locator('[data-adder="condition"]').click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1).getByTestId('field-picker')).toBeFocused();

    await rows.nth(1).getByTestId('remove-row').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).getByTestId('field-picker')).toBeFocused();
  });

  test('removes a nested group with its last row, and keeps one row in the root group', async ({ page }) => {
    const builder = await open(page);

    await builder.locator('[data-adder="group"]').first().click();
    await expect(builder.getByTestId('condition-group')).toHaveCount(2);
    await builder.getByTestId('condition-group').nth(1).getByTestId('remove-row').click();
    await expect(builder.getByTestId('condition-group')).toHaveCount(1);

    await builder.getByTestId('remove-row').click();
    await expect(builder.getByTestId('condition-row')).toHaveCount(1);
  });

  test('disables the adders the limits of the glossary no longer allow', async ({ page, api }) => {
    api.glossary = { ...glossary, limits: { ...glossary.limits, maxConditions: 2, maxDepth: 2 } };
    const builder = await open(page);
    const adder = (kind: string, group = 0) =>
      builder.getByTestId('condition-group').nth(group).locator(`:scope > .group > .group__body > .adders > [data-adder="${kind}"]`);

    await expect(adder('condition')).toBeEnabled();
    await adder('group').click();
    await expect(adder('condition')).toBeDisabled();
    await expect(adder('group')).toBeDisabled();
    await expect(adder('group', 1)).toBeDisabled();

    await builder.getByTestId('remove-group').click();
    await expect(adder('condition')).toBeEnabled();
    await expect(adder('group')).toBeEnabled();
  });

  test('says in words what the control returns and what else it may ask about', async ({ page }) => {
    await open(page);
    const root = glossary.entities.find((entity) => entity.rootable)!;

    await expect(page.getByTestId('root-summary')).toContainText(
      t('editor.root.returns', { entity: label(root.label.plural) }),
    );
  });
});
