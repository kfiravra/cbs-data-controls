import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, git, initGitRepo, rmrf, runScript, tmpDir, writeTree } from './helpers.mjs';

const STUB = '#!/usr/bin/env bash\n';

// The tree as it looks once the five tasks have landed: every part with its manifest and
// its tools (stubs). A fake `dotnet` and `uv` on PATH keep the api and contracts rows
// independent of this machine.
const FULL = {
  'sql/00_database.sql': '',
  'scripts/db-init.sh': STUB,
  'scripts/db-check.sh': STUB,
  'docker-compose.yml': '',
  'scripts/contracts-check.py': '',
  'contracts/glossary.json': '{}',
  'contracts/examples/ex01.json': '{}',
  'contracts/api.md': '',
  'engine/pyproject.toml': '',
  'engine/app/compiler.py': '',
  'engine/.venv/bin/ruff': STUB,
  'engine/.venv/bin/pyright': STUB,
  'engine/.venv/bin/python': STUB,
  'api/DataControls.slnx': '',
  'api/src/DataControls.Api/Program.cs': '',
  'web/angular.json': '{}',
  'web/tsconfig.json': '{"files": [], "references": [{"path": "./tsconfig.app.json"}]}',
  'web/tsconfig.app.json': '{}',
  'web/node_modules/.bin/eslint': STUB,
  'web/src/app/app.ts': '',
  'web/src/app/app.html': '',
};

const fakeBin = writeTree(tmpDir('dc-bin-'), { dotnet: STUB, uv: STUB });
const cleanup = [fakeBin];
after(() => cleanup.forEach(rmrf));

// This machine's PATH with `uv` out of reach. A directory that holds a `uv` is replaced by a mirror of it
// without uv, so the other tools of that directory stay reachable (uv may sit beside bash and jq in /usr/bin).
const pathWithoutUv = (process.env.PATH || '')
  .split(path.delimiter)
  .filter(Boolean)
  .map((dir) => {
    if (!fs.existsSync(path.join(dir, 'uv'))) return dir;
    const mirror = tmpDir('dc-nouv-');
    cleanup.push(mirror);
    for (const name of fs.readdirSync(dir)) {
      if (name !== 'uv' && name !== 'uvx') fs.symlinkSync(path.join(dir, name), path.join(mirror, name));
    }
    return mirror;
  })
  .join(path.delimiter);

function tree(files = FULL) {
  const root = writeTree(tmpDir('dc-map-'), files);
  cleanup.push(root);
  return root;
}

function mapIn(root, ...args) {
  return mapWithPath(root, `${fakeBin}:${process.env.PATH}`, ...args);
}

function mapWithPath(root, PATH, ...args) {
  const r = runScript('lib/pkgmap.sh', undefined, {
    env: { CLAUDE_PROJECT_DIR: root, PATH },
    args,
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [label, cwd, command] = line.split('\t');
      return { label, cwd, command };
    });
}

const labels = (rows) => rows.map((r) => r.label);
const row = (rows, label) => rows.find((r) => r.label === label);
const full = tree();

describe('pkgmap maps touched paths to the verify matrix', () => {
  test('engine Python file -> ruff and pyright from the engine venv, then the print guard', () => {
    const rows = mapIn(full, 'engine/app/compiler.py');
    assert.deepEqual(labels(rows), ['engine-ruff', 'engine-pyright', 'print-guard']);
    assert.equal(row(rows, 'engine-ruff').cwd, 'engine');
    assert.match(row(rows, 'engine-ruff').command, /engine\/\.venv\/bin\/ruff check \.$/);
    assert.match(row(rows, 'engine-pyright').command, /engine\/\.venv\/bin\/pyright$/);
    assert.match(row(rows, 'print-guard').command, /print-guard\.sh engine\/app\/compiler\.py$/);
  });

  test('api C# file -> dotnet build -warnaserror and the format verify in api/, then the print guard', () => {
    const rows = mapIn(full, 'api/src/DataControls.Api/Program.cs');
    assert.deepEqual(labels(rows), ['api-build', 'api-format', 'print-guard']);
    assert.deepEqual(rows.slice(0, 2).map((r) => [r.cwd, r.command]), [
      ['api', 'dotnet build -warnaserror'],
      ['api', 'dotnet format --verify-no-changes'],
    ]);
  });

  test('web TypeScript file -> ngc typecheck, eslint on that file, then the print guard', () => {
    const rows = mapIn(full, 'web/src/app/app.ts');
    assert.deepEqual(labels(rows), ['web-ngc', 'web-eslint', 'print-guard']);
    assert.equal(row(rows, 'web-ngc').cwd, 'web');
    assert.equal(row(rows, 'web-eslint').command, 'npx eslint src/app/app.ts');
  });

  test('web template -> eslint on it as well, no print guard', () => {
    const rows = mapIn(full, 'web/src/app/app.html');
    assert.deepEqual(labels(rows), ['web-ngc', 'web-eslint']);
    assert.equal(row(rows, 'web-eslint').command, 'npx eslint src/app/app.html');
  });

  test('absolute path inside the project is accepted', () => {
    assert.ok(labels(mapIn(full, `${full}/api/src/DataControls.Api/Program.cs`)).includes('api-build'));
  });

  test('contracts JSON -> contracts-check, then the engine, api and web rows (the one channel between them)', () => {
    assert.deepEqual(labels(mapIn(full, 'contracts/examples/ex01.json')), [
      'contracts-check', 'engine-ruff', 'engine-pyright', 'api-build', 'api-format', 'web-ngc',
    ]);
  });

  test('contracts prose and the check script itself -> contracts-check alone, from the root, through uv', () => {
    for (const p of ['contracts/api.md', 'scripts/contracts-check.py']) {
      assert.deepEqual(mapIn(full, p), [{ label: 'contracts-check', cwd: '.', command: 'uv run scripts/contracts-check.py' }], p);
    }
    assert.deepEqual(labels(mapIn(full, '--tests', 'contracts/api.md')), ['contracts-check']);
  });

  test('contracts-check without uv on PATH, or without its script, is a skip line that says why', () => {
    const noUv = mapWithPath(full, pathWithoutUv, 'contracts/api.md');
    assert.deepEqual(labels(noUv), ['skip']);
    assert.match(noUv[0].command, /uv not found on PATH/);
    const noScript = mapIn(tree({ 'contracts/api.md': '' }), 'contracts/api.md');
    assert.deepEqual(labels(noScript), ['skip']);
    assert.match(noScript[0].command, /scripts\/contracts-check\.py missing/);
  });

  test('sql scripts -> nothing by default; --tests initialises the db, then checks it', () => {
    assert.deepEqual(mapIn(full, 'sql/00_database.sql'), []);
    assert.deepEqual(mapIn(full, '--tests', 'docker-compose.yml').map((r) => [r.label, r.command]), [
      ['sql-init', 'docker compose up -d db && scripts/db-init.sh'],
      ['sql-check', 'scripts/db-check.sh'],
    ]);
  });

  test('--tests adds each part\'s suite after its default checks', () => {
    const rows = mapIn(full, '--tests', 'engine/app/compiler.py', 'api/src/DataControls.Api/Program.cs', 'web/src/app/app.ts');
    assert.deepEqual(labels(rows), [
      'engine-ruff', 'engine-pyright', 'engine-test', 'api-build', 'api-format', 'api-test',
      'web-ngc', 'web-eslint', 'web-test', 'web-build', 'print-guard',
    ]);
    assert.equal(row(rows, 'engine-test').command, '.venv/bin/python -m pytest');
    assert.equal(row(rows, 'api-test').command, 'dotnet test');
    assert.equal(row(rows, 'web-test').command, 'npx ng test --watch=false');
    assert.equal(row(rows, 'web-build').command, 'npx ng build');
  });

  test('--all --tests covers every part, sql first, then contracts, and the harness last', () => {
    assert.deepEqual(labels(mapIn(full, '--all', '--tests')), [
      'sql-init', 'sql-check', 'contracts-check', 'engine-ruff', 'engine-pyright', 'engine-test', 'api-build', 'api-format',
      'api-test', 'web-ngc', 'web-eslint', 'web-test', 'web-build', 'print-guard', 'hooks',
    ]);
  });

  test('--all lints web through ng lint and runs the print guard over every part', () => {
    const rows = mapIn(full, '--all');
    assert.equal(row(rows, 'web-eslint').command, 'npx ng lint');
    assert.match(row(rows, 'print-guard').command, /print-guard\.sh --all$/);
  });

  test('hook edits -> hook self-test', () => {
    const rows = mapIn(REPO_ROOT, '.claude/hooks/git-guard.sh');
    assert.deepEqual(labels(rows), ['hooks']);
    assert.match(rows[0].command, /node --test .*hooks\/tests\/\*\.test\.mjs/);
  });

  test('paths outside the project, docs and build output produce nothing', () => {
    assert.deepEqual(mapIn(full, '/outside/file.ts'), []);
    assert.deepEqual(mapIn(full, 'docs/architecture.md'), []);
    assert.deepEqual(mapIn(full, 'api/src/DataControls.Api/obj/Generated.cs'), []);
    assert.deepEqual(mapIn(full, 'web/node_modules/x/index.ts'), []);
    assert.deepEqual(mapIn(full), []);
  });
});

describe('pkgmap on a tree that is not built yet', () => {
  test('a part whose directory does not exist emits nothing: an empty tree gets only the harness row', () => {
    assert.deepEqual(labels(mapIn(tree({}), '--all', '--tests')), ['hooks']);
  });

  test('this repository today: rows only for the parts that exist, the harness last', () => {
    const l = labels(mapIn(REPO_ROOT, '--all', '--tests'));
    for (const part of ['sql', 'engine', 'api', 'web']) {
      if (!fs.existsSync(path.join(REPO_ROOT, part))) {
        assert.ok(!l.some((x) => x.startsWith(`${part}-`)), `${part}/ does not exist but got: ${l}`);
      }
    }
    assert.equal(l.at(-1), 'hooks');
  });

  test('a part without its manifest gets a skip line that names what is missing', () => {
    const bare = tree({ 'engine/app/x.py': '', 'api/src/X.cs': '', 'web/src/app/a.ts': '', 'sql/00_database.sql': '' });
    const skips = mapIn(bare, '--tests', 'sql/00_database.sql', 'engine/app/x.py', 'api/src/X.cs', 'web/src/app/a.ts')
      .filter((r) => r.label === 'skip')
      .map((r) => r.command);
    assert.equal(skips.length, 5, skips.join('\n'));
    assert.match(skips[0], /scripts\/db-init\.sh missing/);
    assert.match(skips[1], /scripts\/db-check\.sh missing/);
    assert.match(skips[2], /engine\/pyproject\.toml missing/);
    assert.match(skips[3], /no \.sln or \.slnx/);
    assert.match(skips[4], /web\/angular\.json missing/);
  });

  test('two solution files in api/, or web without node_modules, also skip with the reason', () => {
    const t = tree({ 'api/A.sln': '', 'api/A.slnx': '', 'api/src/X.cs': '', 'web/angular.json': '{}', 'web/src/app/a.ts': '' });
    const skips = mapIn(t, 'api/src/X.cs', 'web/src/app/a.ts').filter((r) => r.label === 'skip').map((r) => r.command);
    assert.match(skips[0], /2 solution files/);
    assert.match(skips[1], /no node_modules/);
  });
});

// 2026-05-31: a bare `tsc --noEmit` against a solution-style tsconfig.json (`files: []`,
// references only) checked nothing; two TS6133 errors reached a production build. The web
// typecheck names tsconfig.app.json, and refuses to run without it.
describe('pkgmap web typecheck targets tsconfig.app.json (2026-05-31 TS6133 hollow --noEmit)', () => {
  test('the web check is ngc on tsconfig.app.json, never a bare --noEmit on the solution config', () => {
    assert.equal(row(mapIn(full, 'web/src/app/app.ts'), 'web-ngc').command, 'npx ngc -p tsconfig.app.json --noEmit');
  });
  test('a web tree without tsconfig.app.json gets a skip line, not a hollow check', () => {
    const t = tree({ 'web/angular.json': '{}', 'web/node_modules/.bin/eslint': STUB, 'web/src/app/a.ts': '' });
    const rows = mapIn(t, 'web/src/app/a.ts');
    assert.match(row(rows, 'skip').command, /tsconfig\.app\.json missing/);
    assert.equal(row(rows, 'web-ngc'), undefined);
  });
});

// One SQL Server container per machine, started from the main tree: a compose run in a
// worktree would start a second one under another project name and collide on :1433.
describe('pkgmap keeps one SQL Server container per machine', () => {
  const main = tmpDir('dc-main-');
  const parent = tmpDir('dc-wt-');
  const wt = path.join(parent, 'cbs-x');
  cleanup.push(main, parent);
  initGitRepo(main);
  const added = git(main, 'worktree', 'add', '--quiet', '-b', 'feat/x', wt);
  const sql = { 'sql/00_database.sql': '', 'scripts/db-init.sh': STUB, 'scripts/db-check.sh': STUB };

  test('in a linked worktree sql-init is a skip line and sql-check still runs', () => {
    assert.equal(added.status, 0, added.stderr);
    writeTree(wt, sql);
    const rows = mapIn(wt, '--tests', 'sql/00_database.sql');
    assert.deepEqual(labels(rows), ['skip', 'sql-check']);
    assert.match(rows[0].command, /main tree only/);
  });
  test('in the main tree of the same repository sql-init runs', () => {
    writeTree(main, sql);
    assert.deepEqual(labels(mapIn(main, '--tests', 'sql/00_database.sql')), ['sql-init', 'sql-check']);
  });
});
