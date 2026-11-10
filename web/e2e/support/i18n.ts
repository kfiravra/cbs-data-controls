import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Tree { [key: string]: string | Tree }

const he = JSON.parse(readFileSync(join(__dirname, '../../src/assets/i18n/he.json'), 'utf8')) as Tree;

/** The interface text of a key, as the app shows it: specs hold no Hebrew of their own. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  let node: string | Tree | undefined = he;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`he.json has no text for "${key}"`);
  }
  return node.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params[name] ?? ''));
}
