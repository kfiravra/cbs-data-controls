import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Specs run from `web/`; the contracts are the repository's, one level up. */
export const WEB_ROOT = process.cwd();
export const CONTRACTS_ROOT = join(WEB_ROOT, '..', 'contracts');

export function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

export function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

/** Every file under `dir` whose name ends with one of `extensions`, as paths relative to `web/`. */
export function listFiles(dir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      found.push(...listFiles(path, extensions));
    } else if (extensions.some((extension) => name.endsWith(extension))) {
      found.push(relative(WEB_ROOT, path));
    }
  }
  return found.sort();
}
