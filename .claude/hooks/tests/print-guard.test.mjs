import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { INFRA_DIR, git, initGitRepo, rmrf, runScript, tmpDir, writeTree } from './helpers.mjs';

// Debug output in service source: Console.Write* in api/, console.log in web/, print( in
// engine/. Tests, specs, e2e and scripts may print; everything else uses the logger.

function repo(files = {}) {
  const dir = tmpDir('dc-pg-');
  initGitRepo(dir);
  writeTree(dir, files);
  after(() => rmrf(dir));
  return dir;
}

const guardIn = (dir, ...args) => runScript('print-guard.sh', undefined, { env: { CLAUDE_PROJECT_DIR: dir }, args });

const files = repo({
  'api/src/Api/Program.cs': 'var app = builder.Build();\nConsole.WriteLine("started");\napp.Run();\n',
  'api/src/Api/Writer.cs': '    Console.Write(x);\n    Console.Error.WriteLine(e);\n    // Console.WriteLine("old");\n    logger.LogInformation("ok");\n',
  'api/tests/Api.Tests/ProgramTests.cs': 'Console.WriteLine("test output is fine");\n',
  'api/src/Api.Tests/Fixture.cs': 'Console.WriteLine("a *.Tests project is a test project");\n',
  'web/src/app/app.ts': 'export class App {\n  init() {\n    console.log(this.state);\n    console.warn("w");\n    console.error("e");\n  }\n}\n',
  'web/src/app/app.spec.ts': 'console.log("spec");\n',
  'web/e2e/helpers.ts': 'console.log("e2e helper");\n',
  'web/src/app/logger.ts': '/**\n * console.log( is banned here.\n */\nexport const level = 1;\n',
  'engine/app/compiler.py': 'def compile():\n    print("debug")\n    return "print(not this)"\n',
  'engine/tests/test_compiler.py': 'print("tests may print")\n',
  'engine/app/conftest.py': 'print("fixtures may print")\n',
  'engine/scripts/seed.py': 'print("scripts may print")\n',
  'docs/notes.md': 'console.log( and print( in prose\n',
  '.claude/hooks/x.mjs': 'console.log("harness code is not service source");\n',
});

describe('print-guard flags debug output in service source', () => {
  test('Console.Write, Console.WriteLine and Console.Error in api source, as path:line: code', () => {
    const r = guardIn(files, 'api/src/Api/Program.cs', 'api/src/Api/Writer.cs');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^api\/src\/Api\/Program\.cs:2: Console\.WriteLine\("started"\);$/m);
    assert.match(r.stdout, /^api\/src\/Api\/Writer\.cs:1: Console\.Write\(x\);$/m);
    assert.match(r.stdout, /^api\/src\/Api\/Writer\.cs:2: Console\.Error\.WriteLine\(e\);$/m);
    assert.doesNotMatch(r.stdout, /Writer\.cs:3:/, 'a commented-out call is a review finding, not a guard hit');
    assert.match(r.stdout, /ILogger<T>/);
    assert.match(r.stdout, /3 debug call/);
  });

  test('console.log in web source; console.warn and console.error pass', () => {
    const r = guardIn(files, 'web/src/app/app.ts');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^web\/src\/app\/app\.ts:3: console\.log\(this\.state\);$/m);
    assert.doesNotMatch(r.stdout, /app\.ts:[45]:/);
  });

  test('print( that starts an engine statement; print( inside a string passes', () => {
    const r = guardIn(files, 'engine/app/compiler.py');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^engine\/app\/compiler\.py:2: print\("debug"\)$/m);
    assert.doesNotMatch(r.stdout, /compiler\.py:3:/);
  });

  test('tests, *.Tests projects, specs, e2e, conftest, scripts and comments are exempt: exit 0, silent', () => {
    const r = guardIn(files, 'api/tests/Api.Tests/ProgramTests.cs', 'api/src/Api.Tests/Fixture.cs', 'web/src/app/app.spec.ts',
      'web/e2e/helpers.ts', 'web/src/app/logger.ts', 'engine/tests/test_compiler.py', 'engine/app/conftest.py', 'engine/scripts/seed.py');
    assert.equal(r.status, 0, r.stdout);
    assert.equal(r.stdout, '');
  });

  test('other folders and languages are ignored, and so are files that do not exist', () => {
    const r = guardIn(files, 'docs/notes.md', '.claude/hooks/x.mjs', 'web/src/app/gone.ts', '/outside/app.ts');
    assert.equal(r.status, 0, r.stdout);
  });

  test('absolute paths inside the project resolve against its root', () => {
    const r = guardIn(files, path.join(files, 'web/src/app/app.ts'));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^web\/src\/app\/app\.ts:3:/m);
  });

  test('--all scans every tracked and untracked file under engine/, api/ and web/', () => {
    const r = guardIn(files, '--all');
    assert.equal(r.status, 1);
    const hitFiles = r.stdout.split('\n').filter((l) => /^\S+:\d+: /.test(l)).map((l) => l.split(':')[0]);
    assert.deepEqual([...new Set(hitFiles)].sort(), [
      'api/src/Api/Program.cs', 'api/src/Api/Writer.cs', 'engine/app/compiler.py', 'web/src/app/app.ts',
    ]);
  });
});

describe('print-guard --staged judges what will be committed', () => {
  const dir = repo();
  const f = 'web/src/app/staged.ts';
  test('a staged console.log fails even after the working copy drops it', () => {
    writeTree(dir, { [f]: 'console.log("staged");\n' });
    git(dir, 'add', f);
    writeTree(dir, { [f]: 'export {};\n' });
    const r = guardIn(dir, '--staged');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^web\/src\/app\/staged\.ts:1: console\.log\("staged"\);$/m);
  });
  test('a clean staged blob passes even when the working copy prints', () => {
    git(dir, 'add', f);
    writeTree(dir, { [f]: 'console.log("not staged");\n' });
    assert.equal(guardIn(dir, '--staged').status, 0);
  });
});

describe('the git pre-commit runs the guard on the staged files (core.hooksPath .claude/hooks/git)', () => {
  const dir = repo();
  const commit = () => git(dir, '-c', `core.hooksPath=${path.join(INFRA_DIR, 'hooks', 'git')}`, 'commit', '-q', '-m', 'feat: x');
  test('refuses a commit with a staged print(, then takes it once the line is gone', () => {
    writeTree(dir, { 'engine/app/x.py': 'print("x")\n' });
    git(dir, 'add', 'engine/app/x.py');
    let r = commit();
    assert.notEqual(r.status, 0, 'the commit went through');
    assert.match(`${r.stdout}\n${r.stderr}`, /engine\/app\/x\.py:1: print\("x"\)/);
    writeTree(dir, { 'engine/app/x.py': 'import logging\n\nlogger = logging.getLogger(__name__)\n' });
    git(dir, 'add', 'engine/app/x.py');
    r = commit();
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  });
});
