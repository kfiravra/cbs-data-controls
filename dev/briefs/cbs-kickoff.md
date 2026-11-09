# data-controls — kickoff: repo, harness, task plans (Kfir, 2026-11-09)

Goal of this file: get from nothing to "five task plans exist, three sessions can start". Everything here is done once.

## 1. Machine (WSL), once

```bash
# .NET 10 SDK (Microsoft repo), Angular CLI, ODBC driver for local Python runs
sudo apt-get install -y dotnet-sdk-10.0 unixodbc-dev
npm i -g @angular/cli
# Microsoft ODBC Driver 18 for SQL Server: follow learn.microsoft.com "Install the Microsoft ODBC driver for SQL Server (Linux)" for Ubuntu
dotnet --version && ng version && python3 --version && docker --version
```

Already there: Node 22, Python 3.12, Docker Desktop, Claude Code, user-level skills `design-taste-frontend` and `impeccable`.

## 2. Repository

```bash
cd ~/projects
gh repo create kfiravra/cbs-data-controls --private --clone
cd cbs-data-controls
mkdir -p docs dev/briefs
cp ~/Downloads/CBS_Data_Controls_Architecture.md docs/architecture.md
cp ~/Downloads/cbs-kickoff.md dev/briefs/kickoff.md
printf 'dev/active/\ndev/completed/\n.env\n**/.venv/\n**/node_modules/\n**/bin/\n**/obj/\n' > .gitignore
git add . && git commit -m "docs: architecture and kickoff" && git push -u origin main
```

Private until submission; then either add the graders as collaborators or send the zip they ask for.

## 3. Harness: copy VIE's `.claude`, let CC adapt it

```bash
cp -r ~/projects/video-insight-engine/.claude ~/projects/cbs-data-controls/.claude
cp ~/projects/video-insight-engine/.mcp.json ~/projects/cbs-data-controls/.mcp.json
cd ~/projects/cbs-data-controls
rm -rf .claude/skills/vie-api .claude/skills/vie-web .claude/skills/vie-python
rm -rf .claude/rules/*            # VIE's per-language rules; new ones are written below
```

Open Claude Code in the repo (Fable), paste:

```
Adapt this harness, copied from another project, to this repository. Read docs/architecture.md and dev/briefs/kickoff.md first.
1. Rewrite .claude/CLAUDE.md for this repo: project map (web/ Angular :4200 → api/ .NET 10 :5000 → engine/ FastAPI :8000 → SQL Server :1433; contracts/ is the only channel between services), the Verify section (sql: docker compose up -d db && scripts/db-init.sh, scripts/db-check.sh · engine: pytest, ruff, pyright · api: dotnet build -warnaserror, dotnet test, dotnet format --verify-no-changes · web: ng lint, ng test --watch=false, ng build, Playwright e2e with screenshots at 390 and 1440 · never two suites at once, one SQL Server container per machine), Gotchas (NVARCHAR + Hebrew_CI_AS; identifiers only from the glossary, values only bound, one SELECT; engine refuses to start on glossary mismatch; two logins, two connection strings; dir=rtl + logical CSS; English-only code, Hebrew only in web/src/assets/i18n/*.json and contracts/glossary.json), and keep the Git and Working conventions sections as they are.
2. Replace the three removed stack skills with dc-engine (FastAPI, SQLAlchemy Core builder, pytest golden tests, never f-string SQL), dc-api (.NET 10 controllers, EF Core for dq, ProblemDetails code+params, resilience client, xUnit + WebApplicationFactory), dc-web (Angular 20 standalone + signals, ngx-translate he/en, Angular Material RTL, reusable components list, Playwright), dc-sql (script order, naming, planted-violation comments, Hebrew seed). Each with a paths: frontmatter so it loads on its own.
3. Write .claude/rules for *.cs, *.ts, *.py, *.sql in the same shape as the old ones. Update the print guard hook to flag Console.WriteLine, console.log and print( in committed source. Update /check to the verify matrix above.
4. Remove anything VIE-specific left (names, paths, docker services). Run node --test .claude/hooks/tests/*.test.mjs until green.
5. Commit as chore(claude): project harness. Report what changed in ten lines. Stop.
```

Check: `/context` shows one CLAUDE.md, `/` lists task-plan, resume, check, phase-review, ship, guard, dc-engine, dc-api, dc-web, dc-sql, design-taste-frontend, impeccable.

## 4. Design doc (before dc-web starts, any time after step 3)

Same session or a new one (Fable):

```
Write docs/design.md for the client described in docs/architecture.md §8: business users at a statistics bureau, Hebrew RTL, mobile first, data tables and a condition builder. Use the design-taste-frontend skill to deal and pick the direction, then /impeccable init (PRODUCT.md) and /impeccable document to record tokens, type, components, responsive rules, motion and the empty/error states. Screenshots of a mock of the three screens at 390 and 1440 in dev/active/design/. No app code. Commit docs/design.md. Stop.
```

## 5. The five task plans

Run in order; each `/task-plan` interviews you, then writes `dev/active/<slug>/plan.md` + `notes.md`. Answer the interviews from `docs/architecture.md`; where it asks something the doc decides, say "per architecture.md §N".

Main tree (Fable):
```
/task-plan dc-contracts — task 1 of docs/architecture.md §19: repo skeleton, compose with SQL Server + init container, sql/ (hr, dq, two logins, Hebrew seed with planted violations, indexes), the whole contracts/ folder (§5.1), README skeleton. Gate: clean container up + init, db-check prints the expected violating records per example, schema validates the six examples.
```
Run it to its gate (Opus). Then, and only then, the three worktrees:

```bash
cd ~/projects/cbs-data-controls && git fetch origin
git worktree add ../cbs-engine -b feat/engine origin/main
git worktree add ../cbs-api    -b feat/api    origin/main
git worktree add ../cbs-web    -b feat/web    origin/main
```

One Claude Code session per worktree (Fable for the plan, switch to Opus to execute):
```
/task-plan dc-engine — task 2 of docs/architecture.md §19 (engine, §6, suggestions included). Contracts are frozen in contracts/; the SQL Server container runs from the main tree. Gate per §19.
/task-plan dc-api — task 3 of docs/architecture.md §19 (application API, §7). Contracts are frozen in contracts/; the engine may not exist yet: test against recorded responses shaped by contracts/api.md. Gate per §19.
/task-plan dc-web — task 4 of docs/architecture.md §19 (client, §8, per docs/design.md). Start on what needs no API; wire to the real API as it lands. Gate per §19.
```
Then, after the three are merged, main tree:
```
/task-plan dc-delivery — task 5 of docs/architecture.md §19: compose end to end from a fresh clone, manual path script, docs §17, ai-usage.md, §18 checklist ticked. Gate per §19.
```

## 6. Rules while three sessions run

- One SQL Server container, started once from the main tree (`docker compose up -d db` + init); every session connects to localhost:1433.
- Never two test suites at once (`pgrep -f "pytest|dotnet test|ng test"` first), as in VIE.
- A contract change = one commit to `contracts/` on main + one line pasted into the other two sessions.
- Push, PR, merge only on your word; one PR per task; merge commits.
- Commits in worktrees `--no-verify` after running the checks by hand, as in VIE.
