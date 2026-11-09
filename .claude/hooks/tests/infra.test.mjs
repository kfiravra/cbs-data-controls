import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INFRA_DIR, REPO_ROOT } from './helpers.mjs';

// Contract tests over the infra files themselves: things a reviewer would only
// notice after a bad session.

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${file} has no frontmatter`);
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return out;
}

// The `paths:` list of a skill or rule frontmatter (the globs that load it on its own).
function pathsOf(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${file} has no frontmatter`);
  const lines = m[1].split('\n');
  const start = lines.findIndex((l) => /^paths:\s*$/.test(l));
  if (start < 0) return [];
  const globs = [];
  for (const l of lines.slice(start + 1)) {
    const g = l.match(/^\s+-\s+"?([^"]+?)"?\s*$/);
    if (!g) break;
    globs.push(g[1]);
  }
  return globs;
}

// A YAML plain scalar may not start with an indicator (`[` makes a list, `{` a map,
// `"`/`'`/`*`/`&`/`!`/`|`/`>`/`%`/`@` are syntax) and may not contain `: ` or ` #`.
// Anything else needs double quotes. 2026-11-02: unquoted `[task-name]` hints parsed as
// lists and Claude Code reported "The 'argument-hint' attribute must be a string".
function unsafePlainScalars(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const bad = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z-]+):\s+(.*)$/);
    if (!kv) continue;
    const v = kv[2];
    if (/^".*"$/.test(v)) continue;
    if (/^['*&!|>%@`[{]/.test(v) || /: | #/.test(v)) bad.push(`${kv[1]}: ${v}`);
  }
  return bad;
}

const settings = JSON.parse(fs.readFileSync(path.join(INFRA_DIR, 'settings.json'), 'utf8'));
const agentFiles = fs.readdirSync(path.join(INFRA_DIR, 'agents')).filter((f) => f.endsWith('.md'));
const skillDirs = fs.readdirSync(path.join(INFRA_DIR, 'skills'));
const ruleFiles = fs.readdirSync(path.join(INFRA_DIR, 'rules')).filter((f) => f.endsWith('.md'));
const claudeMd = fs.readFileSync(path.join(INFRA_DIR, 'CLAUDE.md'), 'utf8');

// 2026-10-29 audit: every old agent was `model: inherit` and ran on Fable whenever
// the session did. Subagents default to opus and never inherit the session model.
describe('subagents never inherit the session model (2026-10-29 agents on Fable)', () => {
  test('settings.json pins CLAUDE_CODE_SUBAGENT_MODEL to opus', () => {
    assert.equal(settings.env?.CLAUDE_CODE_SUBAGENT_MODEL, 'opus');
  });
  test('every agent file pins a model and it is not inherit', () => {
    assert.ok(agentFiles.length >= 2);
    for (const f of agentFiles) {
      const fm = frontmatter(path.join(INFRA_DIR, 'agents', f));
      assert.ok(fm.model, `${f}: no model`);
      assert.notEqual(fm.model, 'inherit', `${f}: inherits the session model`);
      assert.doesNotMatch(fm.model, /fable/i, `${f}: pinned to Fable`);
    }
  });
  test('no skill asks for a Fable subagent', () => {
    for (const d of skillDirs) {
      const text = fs.readFileSync(path.join(INFRA_DIR, 'skills', d, 'SKILL.md'), 'utf8');
      assert.doesNotMatch(text, /model:\s*["']?fable/i, `${d}: spawns on Fable`);
    }
  });
});

describe('settings.json contract', () => {
  test('attribution trailers are off (user rule: never add Claude credits)', () => {
    assert.equal(settings.attribution, false);
  });
  test('post-edit runs for Bash as well as Edit|Write (2026-11-01 bypass-mode edits invisible)', () => {
    const matchers = settings.hooks.PostToolUse.map((h) => h.matcher);
    assert.ok(matchers.includes('Bash'), matchers.join(', '));
    assert.ok(matchers.some((m) => /Edit/.test(m) && /Write/.test(m)), matchers.join(', '));
    for (const h of settings.hooks.PostToolUse) {
      for (const c of h.hooks) assert.match(c.command, /post-edit\.sh/);
    }
  });
  test('every hook script named in settings.json exists and is executable', () => {
    for (const event of Object.values(settings.hooks)) {
      for (const group of event) {
        for (const h of group.hooks) {
          const rel = h.command.match(/\.claude\/(hooks\/[a-z-]+\.sh)/)?.[1];
          assert.ok(rel, h.command);
          const p = path.join(INFRA_DIR, rel);
          assert.ok(fs.existsSync(p), p);
          assert.ok(fs.statSync(p).mode & 0o111, `${p} is not executable`);
        }
      }
    }
  });
});

describe('/guard skill contract', () => {
  const fm = frontmatter(path.join(INFRA_DIR, 'skills', 'guard', 'SKILL.md'));
  test('is user-invoked only', () => {
    assert.equal(fm['disable-model-invocation'], 'true');
    assert.equal(fm.name, 'guard');
  });
  test('may only run guard-ctl.sh', () => {
    assert.match(fm['allowed-tools'], /guard-ctl\.sh/);
    assert.doesNotMatch(fm['allowed-tools'], /Bash\(\*\)|Bash\(bash \*\)/);
  });
  test('guard-ctl.sh exists and is executable', () => {
    const p = path.join(INFRA_DIR, 'hooks', 'guard-ctl.sh');
    assert.ok(fs.statSync(p).mode & 0o111);
  });
});

describe('skill frontmatter hygiene', () => {
  test('every skill has a name matching its folder and a description', () => {
    for (const d of skillDirs) {
      const fm = frontmatter(path.join(INFRA_DIR, 'skills', d, 'SKILL.md'));
      assert.equal(fm.name, d);
      assert.ok(fm.description && fm.description.length > 20, `${d}: thin description`);
    }
  });
  // 2026-11-02: autocomplete showed `/ship <task-name>` next to `/resume [task-name]`.
  // Claude Code's own convention for argument-hint is square brackets ([issue-number],
  // add [tagId] | remove [tagId]); angle brackets are not part of it.
  test('argument hints use the autocomplete convention: [arg], never <arg> (2026-11-02 mixed hints)', () => {
    let hinted = 0;
    for (const d of skillDirs) {
      const fm = frontmatter(path.join(INFRA_DIR, 'skills', d, 'SKILL.md'));
      if (!fm['argument-hint']) continue;
      hinted++;
      assert.doesNotMatch(fm['argument-hint'], /[<>]/, `${d}: ${fm['argument-hint']}`);
      assert.match(fm['argument-hint'], /^\[.*\]$/, `${d}: ${fm['argument-hint']}`);
    }
    assert.ok(hinted >= 5, `only ${hinted} skills carry an argument-hint`);
  });
  test('every frontmatter value is a valid YAML string: quoted when it starts with [ or holds ": " (2026-11-02 hint parsed as list)', () => {
    const files = [
      ...skillDirs.map((d) => path.join(INFRA_DIR, 'skills', d, 'SKILL.md')),
      ...agentFiles.map((f) => path.join(INFRA_DIR, 'agents', f)),
    ];
    for (const f of files) assert.deepEqual(unsafePlainScalars(f), [], f);
  });
  test('the CLAUDE.md skills line uses the same bracket convention', () => {
    const skillsLine = claudeMd.slice(claudeMd.indexOf('## Skills'));
    assert.doesNotMatch(skillsLine, /\/[a-z-]+ <[^>]+>/, skillsLine);
  });
});

// 2026-11-09: the stack skills and the per-language rules replace the copied ones; each
// must load by itself when a file of its area is touched, and no rule may load always.
describe('stack skills and rules load on their own by path (2026-11-09)', () => {
  const want = {
    'skills/dc-sql/SKILL.md': 'sql/**',
    'skills/dc-engine/SKILL.md': 'engine/**',
    'skills/dc-api/SKILL.md': 'api/**',
    'skills/dc-web/SKILL.md': 'web/**',
    'rules/csharp.md': 'api/**/*.cs',
    'rules/typescript.md': 'web/**/*.ts',
    'rules/python.md': 'engine/**/*.py',
    'rules/sql.md': 'sql/**/*.sql',
  };
  for (const [file, glob] of Object.entries(want)) {
    test(`${file} lists ${glob} under paths:`, () => {
      assert.ok(pathsOf(path.join(INFRA_DIR, file)).includes(glob), pathsOf(path.join(INFRA_DIR, file)).join(', '));
    });
  }
  test('every rule is path-scoped: none loads on every prompt', () => {
    assert.ok(ruleFiles.length >= 4, ruleFiles.join(', '));
    for (const f of ruleFiles) assert.ok(pathsOf(path.join(INFRA_DIR, 'rules', f)).length > 0, f);
  });
});

describe('the print guard runs at commit as well as at Stop', () => {
  test('hooks/git/pre-commit is executable and runs print-guard.sh on the staged files', () => {
    const p = path.join(INFRA_DIR, 'hooks', 'git', 'pre-commit');
    assert.ok(fs.statSync(p).mode & 0o111, `${p} is not executable`);
    assert.match(fs.readFileSync(p, 'utf8'), /print-guard\.sh" --staged/);
  });
  test('print-guard.sh is executable and CLAUDE.md tells a fresh clone how to enable the pre-commit', () => {
    assert.ok(fs.statSync(path.join(INFRA_DIR, 'hooks', 'print-guard.sh')).mode & 0o111);
    assert.match(claudeMd, /git config core\.hooksPath \.claude\/hooks\/git/);
  });
});

describe('CLAUDE.md stays an index', () => {
  test('at most 100 lines: instructions carry only what the code cannot tell you', () => {
    const n = claudeMd.trimEnd().split('\n').length;
    assert.ok(n <= 100, `${n} lines`);
  });
});

// 2026-11-02 /doctor: the root CLAUDE.md double-loaded with .claude/CLAUDE.md and carried stale
// pointers. Doc references in the tree are relative markdown links, and every target must exist.
describe('doc links resolve', () => {
  const mdFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['tests', 'state', 'node_modules'].includes(e.name)) walk(p); }
      else if (e.name.endsWith('.md')) mdFiles.push(p);
    }
  })(INFRA_DIR);
  test('every relative markdown link in .claude/**/*.md points at an existing file', () => {
    const broken = [];
    for (const f of mdFiles) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
        const target = m[1];
        if (/^[a-z]+:/.test(target)) continue;
        if (!fs.existsSync(path.resolve(path.dirname(f), target))) broken.push(`${path.relative(INFRA_DIR, f)} -> ${target}`);
      }
    }
    assert.deepEqual(broken, []);
  });
  test('CLAUDE.md "Where to read" rows are links into the docs, not bare paths', () => {
    const section = claudeMd.slice(claudeMd.indexOf('## Where to read'), claudeMd.indexOf('## Skills'));
    const rows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Topic'));
    assert.ok(rows.length >= 8, section);
    for (const r of rows) {
      const doc = r.split('|')[2];
      assert.match(doc, /\]\(\.\.\/[^)]+\.md\)/, r);
      assert.doesNotMatch(doc, /`[^`]*\/[^`]*`/, r);
    }
    assert.match(section, /\(\.\.\/docs\/architecture\.md\)/);
  });
  test('settings.json no longer excludes a root CLAUDE.md (the file is deleted)', () => {
    assert.equal(settings.claudeMdExcludes, undefined);
    assert.equal(fs.existsSync(path.join(INFRA_DIR, '..', 'CLAUDE.md')), false);
  });
});

// 2026-11-09: this harness was copied from another project and adapted. Nothing of that
// project's stack may survive outside the upstream impeccable skill. The pattern is built
// from parts so this file does not match itself.
describe('no leftovers from the project this harness was copied from (2026-11-09 adaptation)', () => {
  const words = ['video[- ]insight', '\\bvie\\b', '\\bvie[-_]', '@vie/', 'summari[z]er', '\\bpnpm\\b', 'apps/web', 'mongo',
    'redis', 'qdrant', 'rabbit[m]q', 'langfuse', 'youtube', 'fastify', 'zustand', 'litellm', 'PROJECT-BRIEFING'];
  const leftover = new RegExp(words.join('|'), 'i');
  const self = fileURLToPath(import.meta.url);
  test('no file under .claude/ (outside skills/impeccable, state/ and local settings) or .mcp.json names its stack', () => {
    const files = [path.join(REPO_ROOT, '.mcp.json')];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        const rel = path.relative(INFRA_DIR, p);
        if (['state', 'node_modules', path.join('skills', 'impeccable'), 'settings.local.json'].includes(rel) || p === self) continue;
        if (e.isDirectory()) walk(p);
        else files.push(p);
      }
    })(INFRA_DIR);
    const hits = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (leftover.test(line)) hits.push(`${path.relative(REPO_ROOT, f)}:${i + 1}: ${line.trim()}`);
      });
    }
    assert.deepEqual(hits, []);
  });
});
