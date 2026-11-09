import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STATE_ROOT, rmrf, runHook, tmpDir } from './helpers.mjs';

const project = tmpDir();
for (const f of ['web/src/app/a.ts', 'web/src/app/b.ts', 'engine/app/c.py', 'api/src/Api/Program.cs', 'docs/notes.md']) {
  fs.mkdirSync(path.dirname(path.join(project, f)), { recursive: true });
  fs.writeFileSync(path.join(project, f), '');
}
after(() => rmrf(project));

let counter = 0;
function touchedAfter(input) {
  const sid = `pe-${process.pid}-${++counter}`;
  const r = runHook('post-edit.sh', { session_id: sid, ...input }, { env: { CLAUDE_PROJECT_DIR: project } });
  assert.equal(r.status, 0, r.stderr);
  const f = path.join(STATE_ROOT, sid, 'touched');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).sort() : [];
}

describe('post-edit records Edit/Write targets', () => {
  test('a file inside the project is recorded relative to the root', () => {
    assert.deepEqual(touchedAfter({ tool_name: 'Edit', tool_input: { file_path: `${project}/web/src/app/a.ts` } }), ['web/src/app/a.ts']);
  });
  test('a C# edit is recorded too (the Stop check builds and format-verifies it; nothing formats it per edit)', () => {
    assert.deepEqual(touchedAfter({ tool_name: 'Write', tool_input: { file_path: `${project}/api/src/Api/Program.cs` } }), ['api/src/Api/Program.cs']);
  });
  test('a file outside the project (auto-memory, scratchpad) is ignored', () => {
    assert.deepEqual(touchedAfter({ tool_name: 'Write', tool_input: { file_path: '/elsewhere/memory.md' } }), []);
  });
});

// 2026-11-01: in bypass mode the harness edits through sed and heredocs; the Edit|Write
// matcher never fired and the Stop check saw nothing.
describe('post-edit records files written through Bash (2026-11-01 bypass-mode edits invisible)', () => {
  test('sed -i target', () => {
    assert.deepEqual(
      touchedAfter({ tool_name: 'Bash', cwd: project, tool_input: { command: "sed -i 's/a/b/' web/src/app/a.ts" } }),
      ['web/src/app/a.ts'],
    );
  });
  test('sed -i with several files and a cwd inside the project', () => {
    assert.deepEqual(
      touchedAfter({ tool_name: 'Bash', cwd: `${project}/web`, tool_input: { command: 'sed -i -e "s/x/y/" src/app/a.ts src/app/b.ts' } }),
      ['web/src/app/a.ts', 'web/src/app/b.ts'],
    );
  });
  test('redirect and append targets, including heredoc writes', () => {
    assert.deepEqual(
      touchedAfter({ tool_name: 'Bash', cwd: project, tool_input: { command: "cat > web/src/app/b.ts <<'EOF'\nexport {};\nEOF" } }),
      ['web/src/app/b.ts'],
    );
    assert.deepEqual(
      touchedAfter({ tool_name: 'Bash', cwd: project, tool_input: { command: 'echo "x = 1" >> engine/app/c.py' } }),
      ['engine/app/c.py'],
    );
  });
  test('tee targets', () => {
    assert.deepEqual(
      touchedAfter({ tool_name: 'Bash', cwd: project, tool_input: { command: 'printf "a" | tee -a web/src/app/a.ts web/src/app/b.ts >/dev/null' } }),
      ['web/src/app/a.ts', 'web/src/app/b.ts'],
    );
  });
  test('absolute paths resolve to project-relative entries', () => {
    assert.deepEqual(
      touchedAfter({ tool_name: 'Bash', cwd: '/tmp', tool_input: { command: `sed -i 's/a/b/' ${project}/web/src/app/a.ts` } }),
      ['web/src/app/a.ts'],
    );
  });
  test('read-only commands, /dev/null, descriptors and non-existent targets record nothing', () => {
    for (const command of [
      'git status',
      'cat web/src/app/a.ts',
      'npm test 2>&1 | tail -5',
      'echo hi > /dev/null',
      'echo hi > web/src/app/does-not-exist.ts; rm web/src/app/does-not-exist.ts',
      'grep -r "sed -i" docs/',
    ]) {
      assert.deepEqual(touchedAfter({ tool_name: 'Bash', cwd: project, tool_input: { command } }), [], command);
    }
  });
  test('a write outside the project records nothing', () => {
    const outside = tmpDir();
    fs.writeFileSync(path.join(outside, 'x.ts'), '');
    try {
      assert.deepEqual(
        touchedAfter({ tool_name: 'Bash', cwd: outside, tool_input: { command: 'echo 1 > x.ts' } }),
        [],
      );
    } finally {
      rmrf(outside);
    }
  });
});
