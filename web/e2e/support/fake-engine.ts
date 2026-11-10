import {
  ConditionSummary,
  FieldRef,
  Reason,
  TextPart,
  TextPartRole,
  ValidateAnswer,
  Violation,
} from '../../src/app/core/api/api.types';
import {
  ConditionNode,
  Definition,
  DefinitionNode,
  GroupNode,
  RelatedNode,
  Scalar,
} from '../../src/app/core/definition/definition.types';
import { Seed, SeedRow, SeedValue } from './seed';

/* eslint-disable @typescript-eslint/no-explicit-any -- the glossary file is read as loose JSON here */

/**
 * A stand-in for the engine in the mocked specs, so the screens have text to draw for whatever definition a
 * spec builds: it renders sentences and reasons from the glossary's templates by the rules of
 * contracts/errors.md (Rendering), and reads a record's values from the seed script. It validates nothing
 * and decides no violation: which records a run flags comes from the example's expected list. Test support
 * only; the client itself renders nothing.
 */
export class FakeEngine {
  constructor(
    private readonly file: any,
    private readonly seed: Seed,
    private readonly lang = 'he',
  ) {}

  validate(definition: Definition): ValidateAnswer {
    return { valid: true, ...this.sentenceOf(definition) };
  }

  sentenceOf(definition: Definition): { sentence: string; sentenceParts: TextPart[]; conditions: ConditionSummary[] } {
    const root = this.entity(definition.rootEntity);
    const sentenceParts = this.group(definition.where, root);
    const conditions = this.matchable(definition.where).map((node) => {
      const parts = this.node(node, root);
      return { id: node.id, sentence: text(parts), sentenceParts: parts };
    });
    return { sentence: text(sentenceParts), sentenceParts, conditions };
  }

  /** The violation of one record: its identifying fields and one reason per matched node. */
  violation(definition: Definition, key: string, matched: readonly string[], runDate: string): Violation {
    const root = this.entity(definition.rootEntity);
    const row = this.seed[root.table.name].find((candidate) => String(candidate[root.keyColumn]) === key);
    if (!row) {
      throw new Error(`the seed has no ${root.key} with the key ${key}`);
    }
    const display = Object.fromEntries(
      root.identifyingFields.map((field: string) => [field, this.read(row, root, { field }, runDate)]),
    );
    const nodes = this.matchable(definition.where).filter((node) => matched.includes(node.id));
    const reasons = nodes.map((node) => this.reason(node, root, row, runDate));
    const separator: string = this.file.phrases.reasonSeparator[this.lang];
    return { key, display, matched: [...matched], reasons, reasonText: reasons.map((r) => r.text).join(separator) };
  }

  // ---------------------------------------------------------------- the glossary file

  private entity(key: string): any {
    return this.file.entities.find((entity: any) => entity.key === key);
  }

  private relationship(key: string): any {
    return this.file.relationships.find((relationship: any) => relationship.key === key);
  }

  private operator(key: string): any {
    return this.file.operators.find((operator: any) => operator.key === key);
  }

  private field(scope: any, ref: FieldRef): { field: any; last: any | null } {
    let entity = scope;
    let last: any = null;
    for (const key of ref.path ?? []) {
      last = this.relationship(key);
      entity = this.entity(last.to);
    }
    return { field: entity.fields.find((field: any) => field.key === ref.field), last };
  }

  // ---------------------------------------------------------------- rendering

  /** Every condition and every related node outside a related node's `where`, in document order. */
  private matchable(group: GroupNode): (ConditionNode | RelatedNode)[] {
    return group.children.flatMap((child) => (child.type === 'group' ? this.matchable(child) : [child]));
  }

  private group(group: GroupNode, scope: any): TextPart[] {
    const joiner: string = this.file.phrases[group.op][this.lang];
    return group.children.flatMap((child, index) => {
      const parts =
        child.type === 'group'
          ? [
              { text: this.file.phrases.groupOpen[this.lang] as string },
              ...this.group(child, scope),
              { text: this.file.phrases.groupClose[this.lang] as string },
            ]
          : this.node(child, scope);
      return index === 0 ? parts : [{ text: joiner }, ...parts];
    });
  }

  private node(node: DefinitionNode, scope: any): TextPart[] {
    if (node.type === 'group') {
      return this.group(node, scope);
    }
    return node.type === 'related' ? this.related(node, scope, 'sentence') : this.condition(node, scope, 'sentence');
  }

  private related(node: RelatedNode, scope: any, kind: 'sentence' | 'reason'): TextPart[] {
    const relationship = this.relationship(node.relationship);
    const phrase = this.file.phrases[node.quantifier === 'any' ? 'relatedAny' : 'relatedNone'][kind][this.lang];
    return fill(phrase, node.id, {
      relationship: [{ text: relationship.label[this.lang], nodeId: node.id, role: 'relationship' }],
      conditions: this.group(node.where, this.entity(relationship.to)),
    });
  }

  private fieldLabel(scope: any, ref: FieldRef): string {
    const { field, last } = this.field(scope, ref);
    const label: string = field.label[this.lang];
    return last
      ? (this.file.phrases.fieldOnPath[this.lang] as string)
          .replace('{field}', label)
          .replace('{relationship}', last.label[this.lang])
      : label;
  }

  private condition(
    node: ConditionNode,
    scope: any,
    kind: 'sentence' | 'reason',
    actual?: Scalar | null,
    otherActual?: Scalar | null,
  ): TextPart[] {
    const { field } = this.field(scope, node.left);
    const variants = this.operator(node.operator)[kind];
    const order = node.right ? [`${field.type}.field`, 'field', field.type, 'default'] : [field.type, 'default'];
    const template: string = variants[order.find((variant) => variants[variant])!][this.lang];
    const part = (value: string, role: TextPartRole): TextPart[] =>
      value === '' ? [] : [{ text: value, nodeId: node.id, role }];
    const separator: string = this.file.phrases.listSeparator[this.lang];
    const operands = node.values ?? (node.value === undefined ? [] : [node.value]);
    return fill(template, node.id, {
      field: part(this.fieldLabel(scope, node.left), 'field'),
      other: node.right ? part(this.fieldLabel(scope, node.right), 'other') : [],
      value: part(operands[0] === undefined ? '' : this.format(operands[0], field), 'value'),
      value2: part(operands[1] === undefined ? '' : this.format(operands[1], field), 'value'),
      values: operands.flatMap((value, index) => [
        ...(index === 0 ? [] : [{ text: separator, nodeId: node.id }]),
        ...part(this.format(value, field), 'value'),
      ]),
      actual: part(this.format(actual ?? null, field), 'actual'),
      otherActual: part(this.format(otherActual ?? null, node.right ? this.field(scope, node.right).field : field), 'otherActual'),
    });
  }

  private reason(node: ConditionNode | RelatedNode, scope: any, row: SeedRow, runDate: string): Reason {
    if (node.type === 'related') {
      const textParts = this.related(node, scope, 'reason');
      return {
        conditionId: node.id,
        reasonKey: node.quantifier === 'any' ? 'related_any' : 'related_none',
        params: { relationship: node.relationship },
        text: text(textParts),
        textParts,
      };
    }
    const actual = this.read(row, scope, node.left, runDate);
    const rightActual = node.right ? this.read(row, scope, node.right, runDate) : undefined;
    const textParts = this.condition(node, scope, 'reason', actual, rightActual);
    const operand =
      node.right !== undefined
        ? { right: node.right, rightActual }
        : node.values !== undefined
          ? { values: node.values }
          : node.value !== undefined
            ? { value: node.value }
            : {};
    return {
      conditionId: node.id,
      reasonKey: node.operator,
      params: { left: node.left, actual, ...operand },
      text: text(textParts),
      textParts,
    };
  }

  /** A value as the engine writes it (contracts/errors.md, Rendering, Values). */
  private format(value: Scalar | null, field: any): string {
    if (value === null) {
      return '';
    }
    const format = this.file.formats[this.lang];
    let written = String(value);
    if (field.type === 'date') {
      const [year, month, day] = written.split('-');
      written = format.date.replace('yyyy', year).replace('MM', month).replace('dd', day);
    } else if (field.type === 'number' && !field.identifier) {
      const [whole, fraction] = String(value).split('.');
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.groupSeparator);
      written = fraction ? `${grouped}${format.decimalSeparator}${fraction}` : grouped;
    } else if (field.type === 'enum') {
      const entry = field.enumValues.find((item: any) => item.value.toLowerCase() === written.toLowerCase());
      written = entry ? entry.label[this.lang] : written;
    } else if (field.type === 'bool') {
      written = field.valueLabels[value ? 'true' : 'false'][this.lang];
    }
    return field.unit ? `${written} ${field.unit[this.lang]}` : written;
  }

  // ---------------------------------------------------------------- the seed

  /** A record's value of a field, read through the glossary's physical names. */
  private read(row: SeedRow, scope: any, ref: FieldRef, runDate: string): Scalar | null {
    let entity = scope;
    let current: SeedRow | undefined = row;
    for (const key of ref.path ?? []) {
      const relationship = this.relationship(key);
      const from: SeedValue | undefined = current?.[relationship.join.fromColumn];
      entity = this.entity(relationship.to);
      current = this.seed[entity.table.name].find((candidate) => candidate[relationship.join.toColumn] === from);
    }
    const field = entity.fields.find((candidate: any) => candidate.key === ref.field);
    if (!current) {
      return null;
    }
    if (field.computed) {
      return ageYears(String(current[field.computed.over]), runDate);
    }
    const value = current[field.column];
    return field.type === 'bool' && value !== null ? value === 1 : value;
  }
}

/** contracts/errors.md, Age: whole years from the date to the run date. */
function ageYears(date: string, runDate: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [runYear, runMonth, runDay] = runDate.split('-').map(Number);
  const before = runMonth < month || (runMonth === month && runDay < day);
  return runYear - year - (before ? 1 : 0);
}

function text(parts: readonly TextPart[]): string {
  return parts.map((part) => part.text).join('');
}

/** A template split at its placeholders: template text becomes parts of the node, a placeholder its fill. */
function fill(template: string, nodeId: string, fills: Record<string, TextPart[]>): TextPart[] {
  return template
    .split(/(\{[A-Za-z0-9]+\})/)
    .filter((piece) => piece !== '')
    .flatMap((piece) => {
      const name = /^\{([A-Za-z0-9]+)\}$/.exec(piece)?.[1];
      return name ? (fills[name] ?? []) : [{ text: piece, nodeId }];
    });
}
