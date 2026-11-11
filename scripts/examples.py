#!/usr/bin/env python3
"""Loads, verifies and documents the example controls of contracts/examples.

  python3 scripts/examples.py load      post each example that the list does not hold yet; runs nothing
  python3 scripts/examples.py verify    load what is missing, run every example, compare with its expected records
  python3 scripts/examples.py docs      run every example and write the generated region of docs/examples.md

Options: --base-url URL (default http://localhost:$APP_PORT, 5000 when unset), --dir DIR (the examples folder),
and for docs --out FILE and --check (write nothing; exit 1 when the file differs).

Standard library only, Python 3.12 or later. It speaks only to the application api of contracts/api.md: it
never opens the database and never calls the engine. `load` is what the `examples` service of
docker-compose.yml runs on the first start; LOAD_EXAMPLES=false makes it do nothing. `verify` and `docs` are
test tools: every run they start stays in the store, like a run started from the interface.

What it prints is ASCII (ids, counts and codes, never a Hebrew name), because a Windows console may not be
able to encode Hebrew. Every file is read and written as UTF-8.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

# The order the documents and the client's tests give the six examples: the four of the assignment, then two
# more. A file that is not named here follows them, by name.
ORDER = (
    "minor-high-salary",
    "termination-before-hire",
    "active-in-inactive-department",
    "missing-mandatory-data",
    "department-without-active-employees",
    "inactive-ministry-salary-out-of-range",
)

REGION_START = "<!-- generated:start (scripts/examples.py docs) -->"
REGION_END = "<!-- generated:end -->"

HEALTH_WAIT_SECONDS = 120
REQUEST_TIMEOUT_SECONDS = 200
PAGE_SIZE = 200


class Failure(Exception):
    """Something that stops the command; its text is ASCII."""


@dataclass(frozen=True)
class Answer:
    status: int
    body: Any
    correlation_id: str


class Api:
    """The application api, by urllib. Every answer comes back whatever its status."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.language = "he"

    def call(self, method: str, path: str, body: Any = None, query: dict[str, Any] | None = None) -> Answer:
        url = self.base_url + path
        if query:
            url += "?" + urllib.parse.urlencode(query)
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Accept", "application/json")
        request.add_header("Accept-Language", self.language)
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return _answer(response.status, response.read(), response.headers.get("X-Correlation-Id"))
        except urllib.error.HTTPError as error:
            return _answer(error.code, error.read(), error.headers.get("X-Correlation-Id"))

    def expect(self, wanted: int, method: str, path: str, body: Any = None, query: dict[str, Any] | None = None) -> Any:
        answer = self.call(method, path, body, query)
        if answer.status != wanted:
            code = answer.body.get("code") if isinstance(answer.body, dict) else None
            raise Failure(
                f"{method} {path} answered {answer.status} (code {code}, correlation id {answer.correlation_id})"
            )
        return answer.body


def _answer(status: int, raw: bytes, correlation_id: str | None) -> Answer:
    try:
        body = json.loads(raw.decode("utf-8")) if raw else None
    except ValueError:
        body = None
    return Answer(status, body, correlation_id or "none")


def wait_until_healthy(api: Api) -> None:
    """Waits until the api says that its database and its engine both answer."""
    deadline = time.monotonic() + HEALTH_WAIT_SECONDS
    last = "no answer"
    while True:
        try:
            answer = api.call("GET", "/api/v1/health")
            if isinstance(answer.body, dict):
                if answer.body.get("status") == "ok":
                    return
                last = f"database {answer.body.get('database')}, engine {answer.body.get('engine')}"
            else:
                last = f"status {answer.status}"
        except OSError as error:
            last = type(error).__name__
        if time.monotonic() >= deadline:
            raise Failure(f"{api.base_url}/api/v1/health is not ok after {HEALTH_WAIT_SECONDS} seconds ({last})")
        time.sleep(2)


def read_examples(folder: Path) -> list[dict[str, Any]]:
    files = sorted(folder.glob("*.json"))
    if not files:
        raise Failure(f"no example files in {folder}")
    examples = [json.loads(file.read_text(encoding="utf-8")) for file in files]
    rank = {example_id: position for position, example_id in enumerate(ORDER)}
    examples.sort(key=lambda example: (rank.get(example["id"], len(ORDER)), example["id"]))
    return examples


def text_of(texts: dict[str, str], language: str) -> str:
    """One text of an example, in the language asked for or else in the first one it carries."""
    return texts[language] if language in texts else next(iter(texts.values()))


def find_by_name(api: Api, name: str) -> list[dict[str, Any]]:
    """Every control, archived ones included, whose name is exactly this one; the oldest first."""
    found: list[dict[str, Any]] = []
    page = 1
    while True:
        body = api.expect(
            200, "GET", "/api/v1/controls", query={"search": name, "active": "all", "page": page, "pageSize": PAGE_SIZE}
        )
        found.extend(item for item in body["items"] if item["name"] == name)
        if page * PAGE_SIZE >= body["total"] or not body["items"]:
            break
        page += 1
    return sorted(found, key=lambda item: item["id"])


def load(api: Api, examples: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Posts each example that no control is named after, and answers the control of every example."""
    controls: dict[str, dict[str, Any]] = {}
    for example in examples:
        name = text_of(example["name"], api.language)
        existing = find_by_name(api, name)
        if existing:
            # An active one before an archived one; among equals the oldest.
            control = sorted(existing, key=lambda item: (not item["isActive"], item["id"]))[0]
            state = "exists" if control["isActive"] else "exists, archived"
            print(f"SKIP {example['id']}: control {control['id']} {state}")
        else:
            control = api.expect(
                201,
                "POST",
                "/api/v1/controls",
                body={
                    "name": name,
                    "description": text_of(example["description"], api.language),
                    "definition": example["definition"],
                },
            )
            print(f"LOAD {example['id']}: control {control['id']} created")
        controls[example["id"]] = control
    return controls


@dataclass(frozen=True)
class RunOfExample:
    run: dict[str, Any]
    items: list[dict[str, Any]]


def run_and_compare(api: Api, control_id: int, run_date: str, expected: dict[str, Any]) -> tuple[RunOfExample, list[str]]:
    """Starts one run, reads every page of its results and lists what differs from the expected records."""
    run = api.expect(201, "POST", f"/api/v1/controls/{control_id}/runs", body={"runDate": run_date})
    if run["status"] != "succeeded":
        code = (run.get("error") or {}).get("code")
        return RunOfExample(run, []), [f"run {run['id']} is {run['status']} ({code})"]

    items: list[dict[str, Any]] = []
    page = 1
    while True:
        body = api.expect(200, "GET", f"/api/v1/runs/{run['id']}/results", query={"page": page, "pageSize": PAGE_SIZE})
        items.extend(body["items"])
        if len(items) >= body["total"] or not body["items"]:
            break
        page += 1

    faults: list[str] = []
    if run["totalCount"] != expected["total"]:
        faults.append(f"total {run['totalCount']}, expected {expected['total']}")
    if run["capExceeded"]:
        faults.append("the row cap cut the results")
    wanted = {violation["key"]: violation["matched"] for violation in expected["violations"]}
    got = {item["key"]: item["matched"] for item in items}
    missing = sorted(set(wanted) - set(got))
    unexpected = sorted(set(got) - set(wanted))
    if missing:
        faults.append("missing keys " + ",".join(missing))
    if unexpected:
        faults.append("unexpected keys " + ",".join(unexpected))
    for key in sorted(set(wanted) & set(got)):
        if got[key] != wanted[key]:
            faults.append(f"key {key} matched {','.join(got[key])}, expected {','.join(wanted[key])}")
    for item in items:
        lost = [field for field, value in item["display"].items() if isinstance(value, str) and _only_question_marks(value)]
        if lost:
            faults.append(f"key {item['key']}: the text of {','.join(sorted(lost))} is question marks")
    return RunOfExample(run, items), faults


def _only_question_marks(value: str) -> bool:
    stripped = value.replace(" ", "")
    return bool(stripped) and set(stripped) == {"?"}


def check_control(api: Api, example: dict[str, Any], summary: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    """The control an example runs on, or why it cannot: archived, or holding another definition."""
    control = api.expect(200, "GET", f"/api/v1/controls/{summary['id']}")
    if not control["isActive"]:
        return None, f"control {control['id']} is archived and cannot be run"
    if control["definition"] != example["definition"]:
        return None, f"control {control['id']} holds another definition than the example file (left as it is)"
    return control, None


def cmd_load(api: Api, arguments: argparse.Namespace) -> int:
    if os.environ.get("LOAD_EXAMPLES", "true").strip().lower() == "false":
        print("LOAD_EXAMPLES is false: no example is loaded")
        return 0
    wait_until_healthy(api)
    api.language = default_language(api)
    load(api, read_examples(arguments.dir))
    return 0


def cmd_verify(api: Api, arguments: argparse.Namespace) -> int:
    wait_until_healthy(api)
    api.language = default_language(api)
    examples = read_examples(arguments.dir)
    controls = load(api, examples)
    failed = 0
    for example in examples:
        control, fault = check_control(api, example, controls[example["id"]])
        if control is None:
            print(f"FAIL {example['id']}: {fault}")
            failed += 1
            continue
        # The example's own date last: the list then shows that run as the control's last one.
        runs = [(other["runDate"], other["expected"]) for other in example.get("alternateRuns", [])]
        runs.append((example["runDate"], example["expected"]))
        for run_date, expected in runs:
            result, faults = run_and_compare(api, control["id"], run_date, expected)
            where = f"control {control['id']} run {result.run['id']} on {run_date}"
            if faults:
                print(f"FAIL {example['id']}: {where}: " + "; ".join(faults))
                failed += 1
            else:
                print(f"PASS {example['id']}: {where}: {result.run['totalCount']} violations, keys and matched ids as expected")
    return 1 if failed else 0


def default_language(api: Api) -> str:
    return api.expect(200, "GET", "/api/v1/glossary")["defaultLanguage"]


def cmd_docs(api: Api, arguments: argparse.Namespace) -> int:
    wait_until_healthy(api)
    glossary = api.expect(200, "GET", "/api/v1/glossary")
    api.language = glossary["defaultLanguage"]
    examples = read_examples(arguments.dir)
    controls = load(api, examples)
    sections: list[str] = []
    for number, example in enumerate(examples, start=1):
        control, fault = check_control(api, example, controls[example["id"]])
        if control is None:
            raise Failure(f"{example['id']}: {fault}")
        # The example's own date last: the list then shows that run as the control's last one.
        others = []
        for other in example.get("alternateRuns", []):
            other_result, other_faults = run_and_compare(api, control["id"], other["runDate"], other["expected"])
            if other_faults:
                raise Failure(f"{example['id']} on {other['runDate']}: " + "; ".join(other_faults))
            others.append((other["runDate"], other_result.run["totalCount"]))
        result, faults = run_and_compare(api, control["id"], example["runDate"], example["expected"])
        if faults:
            raise Failure(f"{example['id']}: " + "; ".join(faults))
        sections.append(render_example(number, example, result, others, glossary, api.language))
        print(f"DOCS {example['id']}: {result.run['totalCount']} violations")

    region = REGION_START + "\n\n" + "\n".join(sections) + REGION_END
    out: Path = arguments.out
    if not out.is_file():
        raise Failure(f"{out} does not exist: the hand-written frame with the two markers comes first")
    current = out.read_text(encoding="utf-8")
    start = current.find(REGION_START)
    end = current.find(REGION_END)
    if start < 0 or end < start:
        raise Failure(f"{out} lacks the generated region's two marker lines")
    updated = current[:start] + region + current[end + len(REGION_END) :]
    if arguments.check:
        if updated != current:
            print(f"CHECK {out.name}: the generated region differs from a fresh run")
            return 1
        print(f"CHECK {out.name}: the generated region matches a fresh run")
        return 0
    out.write_text(updated, encoding="utf-8", newline="\n")
    print(f"WROTE {out.name}: {len(examples)} examples")
    return 0


def render_example(
    number: int,
    example: dict[str, Any],
    result: RunOfExample,
    others: list[tuple[str, int]],
    glossary: dict[str, Any],
    language: str,
) -> str:
    """One example as Markdown. The sentence and the reasons are the engine's text, copied and never rendered here."""
    run = result.run
    entity = next(entity for entity in glossary["entities"] if entity["key"] == run["rootEntity"])
    labels = {field["key"]: field["label"][language] for field in entity["fields"]}
    columns = entity["identifyingFields"]

    lines = [
        f"### {number}. {rtl(text_of(example['name'], language))}",
        "",
        f"`contracts/examples/{example['id']}.json`"
        + (" · one of the assignment's four examples" if number <= 4 else " · an additional example")
        + (" · also proposed by the suggestions" if example.get("heuristic") else ""),
        "",
        f'<p dir="rtl">{escape(text_of(example["description"], language))}</p>',
        "",
        "The rule in words, as the engine renders it:",
        "",
        f'<p dir="rtl"><strong>{escape(run["sentence"])}</strong></p>',
        "",
        "```json",
        json.dumps(example["definition"], ensure_ascii=False, indent=2),
        "```",
        "",
        f"Run date {run['runDate']}: **{run['totalCount']}** of the seed's {entity['label']['plural'][language]} "
        f"({entity['key']}) are flagged."
        + "".join(f" On {run_date}: {total}." for run_date, total in others),
        "",
        "| " + " | ".join(rtl(labels[column]) for column in columns) + " | Matched | Reason, as the engine renders it |",
        "|" + "---|" * (len(columns) + 2),
    ]
    for item in result.items:
        cells = [cell(item["display"].get(column)) for column in columns]
        cells.append(", ".join(f"`{node}`" for node in item["matched"]))
        cells.append(rtl(item["reasonText"]))
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")
    return "\n".join(lines) + "\n"


def escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("|", "\\|")


def rtl(text: str) -> str:
    """Hebrew inside an English page: its own direction, so brackets and numbers stay where they belong."""
    return f'<span dir="rtl">{escape(text)}</span>'


def cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return rtl(value)
    return str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description="Load, verify and document the example controls through the api.")
    parser.add_argument("command", choices=("load", "verify", "docs"))
    parser.add_argument("--base-url", default=f"http://localhost:{os.environ.get('APP_PORT') or '5000'}")
    parser.add_argument("--dir", type=Path, default=ROOT / "contracts" / "examples")
    parser.add_argument("--out", type=Path, default=ROOT / "docs" / "examples.md")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    api = Api(arguments.base_url)
    commands = {"load": cmd_load, "verify": cmd_verify, "docs": cmd_docs}
    try:
        return commands[arguments.command](api, arguments)
    except Failure as failure:
        print(f"ERROR {failure}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"ERROR {api.base_url} did not answer: {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
