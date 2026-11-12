#!/usr/bin/env python3
"""Lists the backticked tokens of the two contract documents that name nothing in the repository.

  python3 dev/active/dc-delivery/tools/token-check.py

A token is known when it is a string of contracts/ (a key, a value, a code), an existing path, or text that
occurs literally in the sources (engine/app, api/src, web/src, scripts, sql, contracts, docker-compose.yml,
.env.example). What is left is printed, to be explained by hand in gates/A1.txt.
"""
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parents[4]
docs = [root / "docs" / "control-definition.md", root / "docs" / "glossary.md"]
sources = ["contracts", "engine/app", "api/src", "web/src", "scripts", "sql", "docker-compose.yml", ".env.example"]


def occurs(token: str) -> bool:
    found = subprocess.run(
        ["grep", "-rqF", "--", token, *sources], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    return found.returncode == 0


unknown: dict[str, list[str]] = {}
total = 0
for doc in docs:
    text = re.sub(r"```.*?```", "", doc.read_text(encoding="utf-8"), flags=re.S)
    for token in sorted(set(re.findall(r"`([^`\n]+)`", text))):
        total += 1
        candidate = token.strip()
        if (root / candidate).exists() or (root / "docs" / candidate).exists():
            continue
        if occurs(candidate):
            continue
        unknown.setdefault(candidate, []).append(doc.name)
print(f"{total} backticked tokens in {len(docs)} documents; {len(unknown)} occur nowhere in the sources:")
for token, where in sorted(unknown.items()):
    print(f"  {token}    ({', '.join(where)})")
