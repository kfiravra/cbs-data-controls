import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SeedValue = string | number | null;
export type SeedRow = Record<string, SeedValue>;
/** Table name (as in `hr.<Name>`) to its rows, column name to value. */
export type Seed = Record<string, SeedRow[]>;

const SEED_FILE = join(__dirname, '../../../sql/60_seed_hr.sql');

function values(tuple: string): SeedValue[] {
  const found: SeedValue[] = [];
  const token = /N?'((?:[^']|'')*)'|NULL|-?\d+(?:\.\d+)?/g;
  for (let match = token.exec(tuple); match; match = token.exec(tuple)) {
    if (match[1] !== undefined) {
      found.push(match[1].replace(/''/g, "'"));
    } else {
      found.push(match[0] === 'NULL' ? null : Number(match[0]));
    }
  }
  return found;
}

/**
 * The sample organization, read from the repository's seed script: the mocked specs show the same invented
 * people and departments the real stack would, and no fixture holds a name of its own. The script's inserts
 * have one shape: `INSERT INTO hr.<Table> ... (VALUES <one tuple per line>) AS v (<columns>)`.
 */
export function loadSeed(): Seed {
  const sql = readFileSync(SEED_FILE, 'utf8');
  const seed: Seed = {};
  const insert = /INSERT INTO hr\.(\w+)[\s\S]*?\(VALUES([\s\S]*?)\) AS v \(([\s\S]*?)\)/g;
  for (let match = insert.exec(sql); match; match = insert.exec(sql)) {
    const columns = match[3].split(',').map((column) => column.trim());
    seed[match[1]] = match[2]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('('))
      .map((line) => Object.fromEntries(values(line).map((value, index) => [columns[index], value])));
  }
  return seed;
}
