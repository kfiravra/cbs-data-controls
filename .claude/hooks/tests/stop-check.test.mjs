import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STATE_ROOT, initGitRepo, parseJson, rmrf, runHook, tmpDir } from './helpers.mjs';

// A fake package map: one check whose command comes from $FAKE_CMD.
const scratch = tmpDir();
const fakeMap = path.join(scratch, 'pkgmap.sh');
fs.writeFileSync(fakeMap, '#!/usr/bin/env bash\nprintf \'fake\\t.\\t%s\\n\' "$FAKE_CMD"\n');
// The touched file must exist: stop-check drops deleted files (see below).
fs.mkdirSync(path.join(scratch, 'web', 'src', 'app'), { recursive: true });
fs.writeFileSync(path.join(scratch, 'web', 'src', 'app', 'x.ts'), 'export const x = 1;\n');

let counter = 0;
function session(touched = 'web/src/app/x.ts') {
  const sid = `test-${process.pid}-${++counter}`;
  const dir = path.join(STATE_ROOT, sid);
  fs.mkdirSync(dir, { recursive: true });
  if (touched !== null) fs.writeFileSync(path.join(dir, 'touched'), `${touched}\n`);
  return { sid, dir };
}

function stop(sid, cmd, extra = {}, input = {}, root = scratch) {
  return runHook('stop-check.sh', { session_id: sid, stop_hook_active: false, ...input }, {
    env: { CLAUDE_PROJECT_DIR: root, DC_STOP_PKGMAP: fakeMap, FAKE_CMD: cmd, ...extra },
  });
}

// The block reason for a failing fake check whose output is these lines.
function reasonFor(lines, exit = 1) {
  const cmd = [...lines.map((l) => `echo "${l}"`), `exit ${exit}`].join('; ');
  const r = parseJson(stop(session().sid, cmd).stdout);
  assert.equal(r?.decision, 'block', JSON.stringify(r));
  return r.reason;
}

after(() => rmrf(scratch));

describe('stop-check', () => {
  test('nothing touched, clean tree -> silent exit 0', () => {
    const s = session(null);
    const r = stop(s.sid, 'true');
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  test('green check -> silent, touched list cleared', () => {
    const s = session();
    const r = stop(s.sid, 'true');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
    assert.equal(fs.readFileSync(path.join(s.dir, 'touched'), 'utf8'), '');
  });

  test('failing check -> blocks once with the error lines, then only reports the same errors', () => {
    const s = session();
    const cmd = 'echo "src/x.ts(3,5): error TS2322: boom"; exit 1';
    const first = parseJson(stop(s.sid, cmd).stdout);
    assert.ok(first, 'expected JSON');
    assert.equal(first.decision, 'block');
    assert.match(first.reason, /fake \(exit 1\)/);
    assert.match(first.reason, /error TS2322/);
    assert.equal(fs.readFileSync(path.join(s.dir, 'touched'), 'utf8').trim(), 'web/src/app/x.ts');

    const second = parseJson(stop(s.sid, cmd).stdout);
    assert.ok(second, 'expected JSON');
    assert.equal(second.decision, undefined);
    assert.match(second.systemMessage, /errors remain/);
  });

  test('different errors after a block -> blocks again', () => {
    const s = session();
    assert.equal(parseJson(stop(s.sid, 'echo "a.ts(1,1): error TS1"; exit 1').stdout).decision, 'block');
    assert.equal(parseJson(stop(s.sid, 'echo "b.ts(1,1): error TS2"; exit 1').stdout).decision, 'block');
  });

  test('stop_hook_active -> reports instead of blocking', () => {
    const s = session();
    const r = parseJson(stop(s.sid, 'echo "x.py:1:1: F401 unused"; exit 1', {}, { stop_hook_active: true }).stdout);
    assert.equal(r.decision, undefined);
    assert.match(r.systemMessage, /F401/);
  });

  test('red marker (deliberate failing test) -> reports instead of blocking', () => {
    const s = session();
    fs.writeFileSync(path.join(s.dir, 'red'), '');
    const r = parseJson(stop(s.sid, 'exit 1').stdout);
    assert.equal(r.decision, undefined);
    assert.match(r.systemMessage, /errors remain/);
  });

  test('output without recognisable error lines falls back to the tail', () => {
    const s = session();
    const r = parseJson(stop(s.sid, 'echo "something went wrong here"; exit 3').stdout);
    assert.equal(r.decision, 'block');
    assert.match(r.reason, /something went wrong here/);
  });

  test('deadline reached -> check skipped and named, nothing blocked', () => {
    const s = session();
    const r = parseJson(stop(s.sid, 'exit 1', { DC_STOP_DEADLINE: '1' }).stdout);
    assert.equal(r.decision, undefined);
    assert.match(r.systemMessage, /skipped: fake \(deadline\)/);
  });

  test('dry run prints the command and exits 0', () => {
    const s = session();
    const r = stop(s.sid, 'true', { DC_STOP_DRY_RUN: '1' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, 'fake: (cd . && true)');
  });
});

// 2026-11-01: the error grep kept eslint's "line:col error" rows and ruff's code rows but
// dropped the line that names the file.
describe('stop-check keeps the file path in every error (2026-11-01 eslint/ruff paths dropped)', () => {
  test('eslint: the file header line is prefixed onto each error row', () => {
    const s = session();
    const cmd = [
      'echo "/repo/web/src/app/error-banner.ts"',
      'echo "  3:5  error  \'x\' is defined but never used  no-unused-vars"',
      'echo "  9:1  error  Unexpected console statement  no-console"',
      'echo ""',
      'echo "✖ 2 problems (2 errors, 0 warnings)"',
      'exit 1',
    ].join('; ');
    const r = parseJson(stop(s.sid, cmd).stdout);
    assert.equal(r.decision, 'block');
    assert.match(r.reason, /error-banner\.ts:3:5 {2}error/);
    assert.match(r.reason, /error-banner\.ts:9:1 {2}error/);
  });
  test('ruff full format: the code line and its --> file:line:col line both survive', () => {
    const s = session();
    const cmd = [
      'echo "F401 [*] \\`os\\` imported but unused"',
      'echo " --> engine/app/x.py:1:8"',
      'echo "  |"',
      'echo "1 | import os"',
      'echo "Found 1 error."',
      'exit 1',
    ].join('; ');
    const r = parseJson(stop(s.sid, cmd).stdout);
    assert.equal(r.decision, 'block');
    assert.match(r.reason, /F401 \[\*\] `os` imported but unused/);
    assert.match(r.reason, /--> engine\/app\/x\.py:1:8/);
    assert.doesNotMatch(r.reason, /1 \| import os/);
  });
  test('ruff concise format still passes through', () => {
    const s = session();
    const r = parseJson(stop(s.sid, 'echo "engine/app/y.py:2:8: F401 [*] sys imported"; exit 1').stdout);
    assert.match(r.reason, /y\.py:2:8: F401/);
  });
});

// 2026-11-09: the checks of this stack print file:line in four more shapes.
describe('stop-check keeps file:line for the .NET, Angular, pyright and print-guard formats (2026-11-09)', () => {
  const cs = "/repo/api/src/Api/Program.cs(12,5): error CS0103: The name 'x' does not exist in the current context";
  test('MSBuild prints each error twice (build and summary): reported once, without the project suffix', () => {
    const reason = reasonFor([`${cs} [/repo/api/src/Api/Api.csproj]`, 'Build FAILED.', `    ${cs} [/repo/api/src/Api/Api.csproj]`]);
    assert.deepEqual(reason.split('\n').filter((l) => l.includes('CS0103')), [cs]);
  });
  test('dotnet format --verify-no-changes rows keep file(line,col) and their rule', () => {
    const reason = reasonFor([
      '/repo/api/src/Api/Program.cs(3,1): error WHITESPACE: Fix whitespace formatting. [/repo/api/src/Api/Api.csproj]',
      '/repo/api/src/Api/Program.cs(7,9): error IDE0055: Fix formatting [/repo/api/src/Api/Api.csproj]',
    ], 2);
    assert.match(reason, /^\/repo\/api\/src\/Api\/Program\.cs\(3,1\): error WHITESPACE: Fix whitespace formatting\.$/m);
    assert.match(reason, /^\/repo\/api\/src\/Api\/Program\.cs\(7,9\): error IDE0055: Fix formatting$/m);
  });
  test('ngc: file:line:col - error NG… lines pass through', () => {
    const reason = reasonFor(['src/app/app.html:3:5 - error NG8002: Cannot bind to foo since it is not a known property of div.', '', 'Found 1 error.']);
    assert.match(reason, /^src\/app\/app\.html:3:5 - error NG8002: Cannot bind to foo/m);
  });
  test('pyright: the indented file:line:col - error row is kept, trimmed', () => {
    const reason = reasonFor([
      '/repo/engine/app/x.py',
      '  /repo/engine/app/x.py:3:5 - error: Type int is not assignable to declared type str (reportAssignmentType)',
      '1 error, 0 warnings, 0 informations',
    ]);
    assert.match(reason, /^\/repo\/engine\/app\/x\.py:3:5 - error: Type int is not assignable/m);
  });
  test('ng build: the [ERROR] line and its later location line, not the code excerpt', () => {
    const reason = reasonFor([
      '✘ [ERROR] NG8002: Cannot bind to foo since it is not a known property of div. [plugin angular-compiler]',
      '',
      '    src/app/app.html:3:5:',
      '      3 │ <div [foo]=x></div>',
    ]);
    assert.match(reason, /\[ERROR\] NG8002: Cannot bind to foo/);
    assert.match(reason, /^src\/app\/app\.html:3:5$/m);
    assert.doesNotMatch(reason, /3 │/);
  });
  test('print-guard: path:line: code rows pass through', () => {
    const reason = reasonFor(['web/src/app/x.ts:12: console.log(this.state);', '  web: console.log ships to every user browser.']);
    assert.match(reason, /^web\/src\/app\/x\.ts:12: console\.log\(this\.state\);$/m);
  });
});

describe('stop-check housekeeping (2026-11-01)', () => {
  test('a touched file that was deleted since is dropped, so nothing runs for it', () => {
    const s = session('web/src/app/gone.ts');
    const r = stop(s.sid, 'exit 1');
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(fs.readFileSync(path.join(s.dir, 'touched'), 'utf8'), '');
  });
  test('the same errors twice clear the touched list so a red session is not re-checked every Stop', () => {
    const s = session();
    const cmd = 'echo "a.ts(1,1): error TS1"; exit 1';
    assert.equal(parseJson(stop(s.sid, cmd).stdout).decision, 'block');
    assert.equal(fs.readFileSync(path.join(s.dir, 'touched'), 'utf8').trim(), 'web/src/app/x.ts');
    assert.match(parseJson(stop(s.sid, cmd).stdout).systemMessage, /errors remain/);
    assert.equal(fs.readFileSync(path.join(s.dir, 'touched'), 'utf8'), '');
    const third = stop(s.sid, cmd);
    assert.equal(third.stdout, '');
  });
});

// 2026-11-01: in bypass mode edits go through Bash, the Edit|Write matcher never fired,
// and the Stop check saw an empty touched list.
describe('stop-check falls back to the dirty tree when nothing was recorded (2026-11-01 bypass-mode blind spot)', () => {
  const repo = tmpDir();
  initGitRepo(repo);
  fs.mkdirSync(path.join(repo, 'web', 'src', 'app'), { recursive: true });
  const file = path.join(repo, 'web', 'src', 'app', 'x.ts');
  fs.writeFileSync(file, 'export const x = 1;\n');
  after(() => rmrf(repo));

  test('dirty untracked file -> checks run once, then not again for the same tree', () => {
    const s = session(null);
    const first = parseJson(stop(s.sid, 'echo "web/src/app/x.ts(1,1): error TS1"; exit 1', {}, {}, repo).stdout);
    assert.ok(first, 'expected a block from the tree fallback');
    assert.equal(first.decision, 'block');
    // same tree, same errors: report once and remember the tree
    const second = parseJson(stop(s.sid, 'echo "web/src/app/x.ts(1,1): error TS1"; exit 1', {}, {}, repo).stdout);
    assert.match(second.systemMessage, /errors remain/);
    const third = stop(s.sid, 'exit 1', {}, {}, repo);
    assert.equal(third.stdout, '', 'unchanged tree must not be re-checked');
  });
  test('a content change to the dirty file re-arms the fallback', () => {
    const s = session(null);
    assert.equal(stop(s.sid, 'true', {}, {}, repo).stdout, '');
    assert.equal(stop(s.sid, 'exit 1', {}, {}, repo).stdout, '', 'green tree remembered');
    fs.writeFileSync(file, 'export const x = 12345;\n');
    const r = parseJson(stop(s.sid, 'echo "web/src/app/x.ts(1,1): error TS1"; exit 1', {}, {}, repo).stdout);
    assert.equal(r?.decision, 'block');
  });
  test('a recorded touched list takes precedence over the tree', () => {
    const s = session('web/src/app/x.ts');
    fs.writeFileSync(file, 'export const x = 2;\n');
    const r = stop(s.sid, 'true', { DC_STOP_DRY_RUN: '1' }, {}, repo);
    assert.equal(r.stdout, 'fake: (cd . && true)');
  });
});

describe('stop-check without jq reports and exits 0 (2026-11-01 fail-open)', () => {
  test('prints the install hint instead of pretending to check', async () => {
    const { pathWithoutJq } = await import('./helpers.mjs');
    const bin = pathWithoutJq();
    try {
      const s = session();
      const r = stop(s.sid, 'exit 1', { PATH: bin });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /jq is not installed/);
    } finally {
      rmrf(bin);
    }
  });
});
