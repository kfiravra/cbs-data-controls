import { join } from 'node:path';

import { WEB_ROOT, listFiles, readJson, readText } from '../testing/files';

const HEBREW = new RegExp('[\\u0590-\\u05FF]');
const HEX_COLOUR = /#[0-9a-fA-F]{3,8}\b/;
const PHYSICAL_SIDE =
  /\b(left|right)\b|(margin|padding|border|inset)-(left|right)|border-(top|bottom)-(left|right)-radius/;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function leaves(value: Json, path: string): [string, Json][] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

function linesMatching(file: string, pattern: RegExp): string[] {
  return readText(join(WEB_ROOT, file))
    .split('\n')
    .map((line, index) => ({ line: line.replace(/\/\/.*$/, ''), index }))
    .filter(({ line }) => pattern.test(line))
    .map(({ index }) => `${file}:${index + 1}`);
}

describe('translation file', () => {
  const he = readJson<Json>(join(WEB_ROOT, 'src/assets/i18n/he.json'));

  it('holds a non-empty string under every key', () => {
    const empty = leaves(he, '').filter(([, value]) => typeof value !== 'string' || value.trim() === '');
    expect(empty.map(([key]) => key)).toEqual([]);
  });
});

describe('source rules', () => {
  it('keeps Hebrew out of code and templates when the text belongs in he.json', () => {
    const files = listFiles(join(WEB_ROOT, 'src/app'), ['.ts', '.html']);
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap((file) => linesMatching(file, HEBREW))).toEqual([]);
  });

  it('keeps colour literals in tokens.scss when a stylesheet needs a colour', () => {
    const sheets = listFiles(join(WEB_ROOT, 'src'), ['.scss']).filter((file) => !file.endsWith('tokens.scss'));
    const components = listFiles(join(WEB_ROOT, 'src/app'), ['.ts']).filter((file) => !file.endsWith('.spec.ts'));
    expect([...sheets, ...components].flatMap((file) => linesMatching(file, HEX_COLOUR))).toEqual([]);
  });

  it('uses logical properties only when a stylesheet names a side', () => {
    const sheets = listFiles(join(WEB_ROOT, 'src'), ['.scss']);
    expect(sheets.length).toBeGreaterThan(0);
    expect(sheets.flatMap((file) => linesMatching(file, PHYSICAL_SIDE))).toEqual([]);
  });
});
